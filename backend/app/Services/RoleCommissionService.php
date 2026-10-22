<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\CommissionEntry;
use App\Models\CommissionRule;
use App\Models\Contract;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\SubscriptionPack;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Moteur des règles de commission attribuées à des rôles.
 *
 * - Règles « à l'encaissement » (vente, renouvellement, upgrade) : à chaque
 *   paiement, chaque utilisateur impliqué dans la facture (vendeur, équipiers de
 *   la prestation, chef de l'agence, chef du département) dont le rôle porte la
 *   règle reçoit une commission sur la part du paiement qui correspond à la cible.
 *   La base est le montant réellement facturé (prix promotionnel compris).
 * - Règles périodiques (CA mensuel par paliers, croissance vs N-1) : calculées
 *   pour un mois donné, une entrée par bénéficiaire, recalculable tant qu'elle
 *   n'est pas validée.
 * - Primes manuelles : attribuées à la main dans la fourchette de la règle.
 */
class RoleCommissionService
{
    public function __construct(
        private readonly ActivityLogger $logger,
        private readonly ScopeService $scope,
    ) {}

    /**
     * Commissions par rôle d'un encaissement. Idempotent par (paiement, règle,
     * bénéficiaire).
     *
     * seller_covered : le vendeur est rémunéré par les règles de son rôle (au
     * moins une règle active, à l'encaissement ou mensuelle) ; le taux par
     * défaut ne s'applique alors plus à lui.
     *
     * @return array{count: int, seller_covered: bool}
     */
    public function recordForPayment(Invoice $invoice, InvoicePayment $payment): array
    {
        $invoice->loadMissing('commercial');
        $sellerHasRules = $this->sellerHasRoleRules($invoice);
        $rules = $this->activeRules(CommissionRule::PAYMENT_BASES);

        if ($rules->isEmpty() || (float) $invoice->total_amount <= 0) {
            return ['count' => 0, 'seller_covered' => $sellerHasRules];
        }

        $invoice->loadMissing(['items.service:id,category_id', 'items.product:id,category_id', 'contract', 'commercial']);
        $candidates = $this->candidates($invoice);
        $sellerIds = $this->sellerUserIds($invoice);

        $count = 0;
        $sellerCovered = false;

        // Règles applicables à cette facture (périmètre, assiette, cible).
        $applicable = $rules
            ->filter(fn (CommissionRule $rule) => $this->matchesScope($rule, $invoice) && $this->matchesBasis($rule, $invoice, $payment))
            ->map(fn (CommissionRule $rule) => ['rule' => $rule, 'matched' => $this->matchedTotal($rule, $invoice)])
            ->filter(fn (array $row) => $row['matched'] > 0)
            ->values();

        DB::transaction(function () use ($applicable, $invoice, $payment, $candidates, $sellerIds, &$count, &$sellerCovered) {
            foreach ($applicable as ['rule' => $rule, 'matched' => $matchedTotal]) {
                $roleIds = $rule->roles->pluck('id')->all();
                $beneficiaries = $candidates
                    ->filter(fn (User $u) => in_array($u->role_id, $roleIds, true))
                    // Renouvellements non cumulables : une règle qui vise ce
                    // renouvellement précis (ex. le 3e) remplace la règle « chaque
                    // renouvellement » pour le même bénéficiaire.
                    ->reject(fn (User $u) => $this->overriddenBySpecificRenewal($rule, $u, $applicable));

                if ($beneficiaries->isEmpty()) {
                    continue;
                }

                $paidShare = (float) $payment->amount / (float) $invoice->total_amount;
                $base = round($matchedTotal * $paidShare, 2);
                $amount = match ($rule->formula_type) {
                    CommissionRule::FORMULA_FIXED => round((float) $rule->fixed_amount * $paidShare, 2),
                    default => $rule->computeAmount($base),
                };

                if ($amount <= 0) {
                    continue;
                }

                foreach ($beneficiaries as $user) {
                    $exists = CommissionEntry::query()
                        ->where('invoice_payment_id', $payment->id)
                        ->where('commission_rule_id', $rule->id)
                        ->where('beneficiary_user_id', $user->id)
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    CommissionEntry::create([
                        'invoice_id' => $invoice->id,
                        'invoice_payment_id' => $payment->id,
                        'commission_rule_id' => $rule->id,
                        'rule_snapshot' => $rule->snapshot() + ['source' => 'role', 'role_id' => $user->role_id],
                        'beneficiary_user_id' => $user->id,
                        'beneficiary_commercial_id' => $this->commercialIdFor($user),
                        'base_amount' => $base,
                        'amount' => $amount,
                        'category' => $this->categoryFor($rule),
                        'product_id' => $rule->product_id ?? $rule->service_id ?? $rule->package_id ?? $rule->course_id,
                        'product_type' => $this->productTypeFor($rule),
                        'status' => CommissionEntry::STATUS_CALCULATED,
                    ]);

                    $count++;
                    if (in_array($user->id, $sellerIds, true)) {
                        $sellerCovered = true;
                    }

                    $this->logger->log(
                        action: 'commission',
                        entityType: 'invoice',
                        entityId: $invoice->id,
                        description: "Commission de {$amount} (règle {$rule->name}, {$user->first_name} {$user->last_name}) sur la facture {$invoice->number}",
                        newValues: ['rule_id' => $rule->id, 'user_id' => $user->id, 'amount' => $amount, 'payment_id' => $payment->id],
                    );
                }
            }
        });

        return ['count' => $count, 'seller_covered' => $sellerCovered || $sellerHasRules];
    }

    /** Un vendeur de la facture a-t-il un rôle portant au moins une règle active ? */
    private function sellerHasRoleRules(Invoice $invoice): bool
    {
        $roleIds = User::whereIn('id', $this->sellerUserIds($invoice))->pluck('role_id')->filter();
        if ($roleIds->isEmpty()) {
            return false;
        }

        return CommissionRule::query()
            ->active()
            ->whereIn('rule_group_id', DB::table('commission_rule_role')->whereIn('role_id', $roleIds)->select('rule_group_id'))
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', now()->toDateString()))
            ->exists();
    }

    /**
     * Règle « chaque renouvellement » supplantée, pour cet utilisateur, par une
     * règle visant précisément ce renouvellement (même rôle).
     */
    private function overriddenBySpecificRenewal(CommissionRule $rule, User $user, Collection $applicable): bool
    {
        if ($rule->basis !== CommissionRule::BASIS_RENEWAL || $rule->renewal_number !== null) {
            return false;
        }

        return $applicable->contains(fn (array $row) => $row['rule']->basis === CommissionRule::BASIS_RENEWAL
            && $row['rule']->renewal_number !== null
            && $row['rule']->roles->contains('id', $user->role_id));
    }

    /**
     * Calcule les règles périodiques (CA mensuel, croissance) pour un mois
     * « YYYY-MM ». Les entrées encore « calculées » sont mises à jour ; celles
     * déjà validées ou payées ne sont plus touchées.
     *
     * @return array{created: int, updated: int, rows: array<int, array<string, mixed>>}
     */
    public function computePeriod(string $period, ?string $ruleGroupId = null): array
    {
        $month = CarbonImmutable::createFromFormat('Y-m-d', $period.'-01')->startOfMonth();
        $rules = $this->activeRules(CommissionRule::PERIOD_BASES, $month)
            ->when($ruleGroupId, fn ($c) => $c->where('rule_group_id', $ruleGroupId));

        $created = 0;
        $updated = 0;
        $rows = [];

        foreach ($rules as $rule) {
            $users = User::query()
                ->whereIn('role_id', $rule->roles->pluck('id'))
                ->where('is_active', true)
                ->get();

            foreach ($users as $user) {
                $result = $this->periodAmount($rule, $user, $month);

                $existing = CommissionEntry::query()
                    ->whereIn('commission_rule_id', CommissionRule::where('rule_group_id', $rule->rule_group_id)->pluck('id'))
                    ->where('beneficiary_user_id', $user->id)
                    ->where('period', $period)
                    ->first();

                if ($existing && $existing->status !== CommissionEntry::STATUS_CALCULATED) {
                    continue;
                }

                if ($result['amount'] <= 0) {
                    // Plus rien de dû (CA corrigé, facture annulée) : on retire le calcul.
                    $existing?->delete();
                    continue;
                }

                $data = [
                    'commission_rule_id' => $rule->id,
                    'rule_snapshot' => $rule->snapshot() + ['source' => 'role-period', 'period' => $period, 'detail' => $result['detail']],
                    'beneficiary_user_id' => $user->id,
                    'beneficiary_commercial_id' => $this->commercialIdFor($user),
                    'period' => $period,
                    'base_amount' => $result['base'],
                    'amount' => $result['amount'],
                    'category' => 'bonus',
                    'status' => CommissionEntry::STATUS_CALCULATED,
                ];

                if ($existing) {
                    $existing->update($data);
                    $updated++;
                } else {
                    CommissionEntry::create($data);
                    $created++;
                }

                $rows[] = [
                    'rule' => $rule->name,
                    'user' => trim("{$user->first_name} {$user->last_name}"),
                    'base' => $result['base'],
                    'amount' => $result['amount'],
                ];
            }
        }

        return ['created' => $created, 'updated' => $updated, 'rows' => $rows];
    }

    /**
     * Prime manuelle (témoignage, qualité, innovation…) dans la fourchette de la
     * règle. Le bénéficiaire doit avoir un rôle auquel la règle est attribuée.
     */
    public function awardManual(CommissionRule $rule, User $user, float $amount, ?string $label, string $actorId): CommissionEntry
    {
        $entry = CommissionEntry::create([
            'commission_rule_id' => $rule->id,
            'rule_snapshot' => $rule->snapshot() + ['source' => 'role-manual', 'manual' => true, 'label' => $label ?: $rule->name],
            'beneficiary_user_id' => $user->id,
            'beneficiary_commercial_id' => $this->commercialIdFor($user),
            'period' => now()->format('Y-m'),
            'base_amount' => $amount,
            'amount' => $amount,
            'category' => 'bonus',
            'status' => CommissionEntry::STATUS_VALIDATED,
            'validated_by' => $actorId,
            'validated_at' => now(),
        ]);

        $this->logger->log(
            action: 'commission',
            entityType: 'user',
            entityId: $user->id,
            description: "Prime {$rule->name} de {$amount} attribuée à {$user->first_name} {$user->last_name}",
            newValues: ['rule_id' => $rule->id, 'amount' => $amount],
        );

        return $entry;
    }

    /**
     * Dernières versions actives des règles d'assiette donnée, attribuées à au
     * moins un rôle.
     *
     * @param  array<int, string>  $bases
     * @return Collection<int, CommissionRule>
     */
    private function activeRules(array $bases, ?CarbonImmutable $on = null): Collection
    {
        $from = ($on ?? CarbonImmutable::now())->toDateString();
        $to = ($on ? $on->endOfMonth() : CarbonImmutable::now())->toDateString();

        return CommissionRule::query()
            ->active()
            ->whereIn('basis', $bases)
            ->whereIn('rule_group_id', DB::table('commission_rule_role')->select('rule_group_id'))
            ->where(fn ($q) => $q->whereNull('starts_on')->orWhere('starts_on', '<=', $to))
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $from))
            ->with('roles:id,name')
            ->get();
    }

    /**
     * Utilisateurs impliqués dans une facture : vendeur, équipiers (avec compte)
     * de la prestation, chef de l'agence, chefs des départements concernés.
     *
     * @return Collection<int, User>
     */
    private function candidates(Invoice $invoice): Collection
    {
        $ids = collect($this->sellerUserIds($invoice));

        $prestationIds = $this->teamPrestationIds($invoice);
        if ($prestationIds->isNotEmpty()) {
            $ids = $ids
                ->merge(DB::table('prestation_team_members')->whereIn('prestation_id', $prestationIds)->whereNotNull('user_id')->pluck('user_id'))
                ->merge(
                    DB::table('prestation_team_members')
                        ->join('team_members', 'team_members.id', '=', 'prestation_team_members.team_member_id')
                        ->whereIn('prestation_team_members.prestation_id', $prestationIds)
                        ->whereNotNull('team_members.user_id')
                        ->pluck('team_members.user_id')
                );
        }

        if ($invoice->agency_id) {
            $ids = $ids->merge(
                DB::table('user_assignments')->where('agency_id', $invoice->agency_id)->where('is_primary', true)->pluck('user_id')
            );
        }

        $departmentIds = $this->departmentIds($invoice);
        if ($departmentIds->isNotEmpty()) {
            $ids = $ids->merge(DB::table('department_chiefs')->whereIn('department_id', $departmentIds)->pluck('user_id'));
        }

        $ids = $ids->filter()->unique()->values();

        return $ids->isEmpty()
            ? collect()
            : User::query()->whereIn('id', $ids)->where('is_active', true)->get();
    }

    /**
     * Prestations dont l'équipe est concernée. Un renouvellement de package crée
     * une nouvelle prestation sans équipe : on remonte la chaîne des contrats
     * renouvelés jusqu'à la plus récente prestation qui a une équipe.
     */
    private function teamPrestationIds(Invoice $invoice): Collection
    {
        $direct = $invoice->items->pluck('prestation_id')->filter();
        if ($invoice->contract?->prestation_id) {
            $direct->push($invoice->contract->prestation_id);
        }
        $direct = $direct->unique()->values();

        $hasTeam = fn (Collection $ids) => $ids->isNotEmpty()
            && DB::table('prestation_team_members')->whereIn('prestation_id', $ids)->exists();

        if ($hasTeam($direct) || ! $invoice->contract) {
            return $direct;
        }

        $contract = $invoice->contract;
        for ($depth = 0; $contract && $depth < 120; $depth++) {
            $ids = DB::table('prestations')->where('contract_id', $contract->id)->pluck('id')
                ->push($contract->prestation_id)
                ->filter()
                ->unique()
                ->values();

            if ($hasTeam($ids)) {
                return $ids;
            }

            $contract = $contract->parent_contract_id ? Contract::find($contract->parent_contract_id) : null;
        }

        return $direct;
    }

    /**
     * Vendeurs de la facture : commercial, vendeur saisi, formateur vendeur
     * d'une inscription (recommandation de formation).
     *
     * @return array<int, string>
     */
    private function sellerUserIds(Invoice $invoice): array
    {
        $trainerUserIds = DB::table('formation_enrollments')
            ->join('trainers', 'trainers.id', '=', 'formation_enrollments.seller_trainer_id')
            ->where('formation_enrollments.invoice_id', $invoice->id)
            ->whereNotNull('trainers.user_id')
            ->pluck('trainers.user_id');

        return collect([$invoice->commercial?->user_id, $invoice->seller_user_id])
            ->merge($trainerUserIds)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /** Départements concernés : contrat, packages vendus. */
    private function departmentIds(Invoice $invoice): Collection
    {
        $ids = collect([$invoice->contract?->department_id]);

        $packageIds = $invoice->items->pluck('package_id')->filter();
        if ($packageIds->isNotEmpty()) {
            $ids = $ids->merge(SubscriptionPack::whereIn('id', $packageIds)->pluck('department_id'));
        }

        return $ids->filter()->unique()->values();
    }

    private function matchesScope(CommissionRule $rule, Invoice $invoice): bool
    {
        if ($rule->scope_agency_id && $invoice->agency_id !== $rule->scope_agency_id) {
            return false;
        }

        if ($rule->scope_country_id && $invoice->agency?->country_id !== $rule->scope_country_id) {
            return false;
        }

        if ($rule->scope_department_id && ! $this->departmentIds($invoice)->contains($rule->scope_department_id)) {
            return false;
        }

        return true;
    }

    private function matchesBasis(CommissionRule $rule, Invoice $invoice, InvoicePayment $payment): bool
    {
        return match ($rule->basis) {
            CommissionRule::BASIS_RENEWAL => $this->isRenewal($rule, $invoice->contract, $payment),
            CommissionRule::BASIS_UPGRADE => $this->isUpgrade($invoice),
            default => true,
        };
    }

    /**
     * Renouvellement : la facture porte sur un contrat renouvelé, dont
     * renewal_count est le rang du renouvellement (1 = premier, 3 = troisième).
     * - renewal_number vide : chaque renouvellement ;
     * - renewal_number = N : uniquement le N-ième ;
     * - renewal_on_time : payé au plus tard le dernier jour de la période
     *   précédente (renouvellement « à date »).
     */
    private function isRenewal(CommissionRule $rule, ?Contract $contract, InvoicePayment $payment): bool
    {
        if (! $contract || (int) $contract->renewal_count < 1) {
            return false;
        }

        if ($rule->renewal_number !== null && (int) $contract->renewal_count !== (int) $rule->renewal_number) {
            return false;
        }

        if ($rule->renewal_on_time) {
            $previous = $contract->parent_contract_id ? Contract::find($contract->parent_contract_id) : null;
            $paidAt = $payment->paid_at ?? now();

            return $previous?->end_date !== null && $paidAt->lte($previous->end_date->copy()->endOfDay());
        }

        return true;
    }

    /**
     * Upgrade : souscription d'un package plus cher que celui que le client
     * avait déjà dans le même département.
     */
    private function isUpgrade(Invoice $invoice): bool
    {
        $packageIds = $invoice->items->pluck('package_id')->filter();
        if ($packageIds->isEmpty() || ! $invoice->client_id) {
            return false;
        }

        $packages = SubscriptionPack::whereIn('id', $packageIds)->get(['id', 'department_id', 'price_per_month']);

        foreach ($packages as $package) {
            $hadCheaper = Contract::query()
                ->where('client_id', $invoice->client_id)
                ->where('department_id', $package->department_id)
                ->whereNotNull('pack_id')
                ->where('pack_id', '!=', $package->id)
                ->when($invoice->contract_id, fn ($q, $id) => $q->where('id', '!=', $id))
                ->whereIn('pack_id', SubscriptionPack::where('price_per_month', '<', $package->price_per_month)->select('id'))
                ->exists();

            if ($hadCheaper) {
                return true;
            }
        }

        return false;
    }

    /**
     * Total facturé des lignes ciblées par la règle (hors budget publicitaire
     * refacturé). Sans cible : toute la facture. Un genre (target_kind) vise
     * toutes les lignes de ce genre ; un élément précis restreint encore.
     */
    private function matchedTotal(CommissionRule $rule, Invoice $invoice): float
    {
        $lines = $invoice->items->filter(fn (InvoiceItem $l) => ! $l->is_pass_through && (float) $l->line_total > 0);

        if ($rule->course_id || $rule->target_kind === 'course') {
            // Lignes de formation : facture d'inscription, sans service, produit ni package.
            $enrolled = FormationEnrollment::where('invoice_id', $invoice->id)
                ->when($rule->course_id, fn ($q, $id) => $q->where('course_id', $id))
                ->exists();
            $courseLines = $lines->filter(fn (InvoiceItem $l) => ! $l->service_id && ! $l->product_id && ! $l->package_id);

            return $enrolled ? round((float) $courseLines->sum('line_total'), 2) : 0.0;
        }

        $lines = $lines->filter(function (InvoiceItem $line) use ($rule) {
            $kindMatches = match ($rule->target_kind) {
                'product' => (bool) $line->product_id,
                'service' => (bool) $line->service_id,
                'package' => (bool) $line->package_id,
                default => true,
            };
            if (! $kindMatches) {
                return false;
            }
            if ($rule->service_id && $line->service_id !== $rule->service_id) {
                return false;
            }
            if ($rule->product_id && $line->product_id !== $rule->product_id) {
                return false;
            }
            if ($rule->package_id && $line->package_id !== $rule->package_id) {
                return false;
            }
            if ($rule->category_id) {
                $categoryId = $line->service?->category_id ?? $line->product?->category_id;
                if ($categoryId !== $rule->category_id) {
                    return false;
                }
            }

            return true;
        });

        return round((float) $lines->sum('line_total'), 2);
    }

    /**
     * Montant d'une règle périodique pour un utilisateur et un mois.
     *
     * @return array{base: float, amount: float, detail: array<string, mixed>}
     */
    private function periodAmount(CommissionRule $rule, User $user, CarbonImmutable $month): array
    {
        $revenue = $this->revenue($rule, $user, $month);
        $recoveryRef = $rule->recovery_period === 'same_month_last_year' ? $month->subYear() : $month->subMonth();
        $recovery = $this->recoveryRate($rule, $user, $recoveryRef);
        $recoveryOk = $rule->min_recovery_rate === null || ($recovery !== null && $recovery >= (float) $rule->min_recovery_rate);

        $detail = ['revenue' => $revenue, 'recovery_rate' => $recovery, 'recovery_ok' => $recoveryOk];

        if ($rule->basis === CommissionRule::BASIS_GROWTH) {
            $reference = $this->revenue($rule, $user, $month->subYear());
            $detail['reference_revenue'] = $reference;

            if ($reference <= 0) {
                return ['base' => $revenue, 'amount' => 0.0, 'detail' => $detail];
            }

            $ratio = round($revenue / $reference, 4);
            $detail['ratio'] = $ratio;

            if ($rule->growth_multiplier !== null && $ratio < (float) $rule->growth_multiplier) {
                return ['base' => $revenue, 'amount' => 0.0, 'detail' => $detail];
            }

            if (! empty($rule->tiers_json)) {
                $result = $rule->computeThresholdTiers($revenue, $ratio, $recoveryOk);
                $detail['tier'] = $result['tier'];

                return ['base' => $revenue, 'amount' => $result['amount'], 'detail' => $detail];
            }

            $percent = (float) $rule->percent_value;
            if ($rule->max_percent !== null) {
                $percent = min($percent, (float) $rule->max_percent);
            }

            return ['base' => $revenue, 'amount' => round($revenue * $percent / 100, 2), 'detail' => $detail];
        }

        $result = $rule->computeThresholdTiers($revenue, $revenue, $recoveryOk);
        $detail['tier'] = $result['tier'];

        return ['base' => $revenue, 'amount' => $result['amount'], 'detail' => $detail];
    }

    /** CA encaissé sur le mois (paiements reçus), du bénéficiaire ou de son agence. */
    private function revenue(CommissionRule $rule, User $user, CarbonImmutable $month): float
    {
        $query = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->whereBetween('invoice_payments.paid_at', [$month->startOfMonth(), $month->endOfMonth()]);

        if (! $this->applyRevenueScope($query, $rule, $user)) {
            return 0.0;
        }

        return round((float) $query->sum('invoice_payments.amount'), 2);
    }

    /** Taux de recouvrement (%) des factures émises sur le mois de référence. */
    private function recoveryRate(CommissionRule $rule, User $user, CarbonImmutable $month): ?float
    {
        $query = DB::table('invoices')
            ->whereNull('invoices.cancelled_at')
            ->whereBetween('invoices.invoice_date', [$month->startOfMonth(), $month->endOfMonth()]);

        if (! $this->applyRevenueScope($query, $rule, $user)) {
            return null;
        }

        $totals = $query->selectRaw('coalesce(sum(invoices.total_amount), 0) as billed, coalesce(sum(invoices.amount_paid), 0) as paid')->first();

        return (float) $totals->billed > 0 ? round((float) $totals->paid / (float) $totals->billed * 100, 2) : null;
    }

    /** Restreint une requête sur `invoices` au périmètre de la règle ; false = rien à compter. */
    private function applyRevenueScope($query, CommissionRule $rule, User $user): bool
    {
        if ($rule->revenue_scope === 'agency') {
            $agencyIds = DB::table('user_assignments')->where('user_id', $user->id)->where('is_primary', true)->pluck('agency_id');
            if ($agencyIds->isEmpty()) {
                $agencyIds = collect($this->scope->agencyIds($user) ?? []);
            }
            if ($agencyIds->isEmpty()) {
                return false;
            }
            $query->whereIn('invoices.agency_id', $agencyIds);

            return true;
        }

        $commercialIds = Commercial::where('user_id', $user->id)->pluck('id');
        $query->where(function ($q) use ($user, $commercialIds) {
            $q->where('invoices.seller_user_id', $user->id);
            if ($commercialIds->isNotEmpty()) {
                $q->orWhereIn('invoices.commercial_id', $commercialIds);
            }
        });

        return true;
    }

    private function commercialIdFor(User $user): ?string
    {
        return Commercial::where('user_id', $user->id)->value('id');
    }

    private function categoryFor(CommissionRule $rule): string
    {
        return match (true) {
            (bool) $rule->package_id, $rule->target_kind === 'package', $rule->basis === CommissionRule::BASIS_RENEWAL, $rule->basis === CommissionRule::BASIS_UPGRADE => 'agency',
            (bool) $rule->course_id, $rule->target_kind === 'course' => 'training',
            default => 'service',
        };
    }

    private function productTypeFor(CommissionRule $rule): ?string
    {
        return match (true) {
            (bool) $rule->product_id => 'product',
            (bool) $rule->service_id => 'service',
            (bool) $rule->package_id => 'package',
            (bool) $rule->course_id => 'course',
            default => $rule->target_kind,
        };
    }
}
