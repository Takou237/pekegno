<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\CommissionEntry;
use App\Models\CommissionPayment;
use App\Models\CommissionRule;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\FormationEnrollment;
use App\Models\SellerProfile;
use Illuminate\Support\Facades\DB;

class CommissionService
{
    public function __construct(private readonly ActivityLogger $logger) {}

    /**
     * Calcule les commissions versées à l'occasion d'un encaissement (règle multi-lignes).
     *
     * Chaque ligne reçoit une part du paiement proportionnelle à son poids dans la facture.
     * Une ligne dont le service a une prime fixe (bonus_fixed) est calculée à part :
     * prime fixe proratée sur le paiement. Les autres lignes suivent la règle du commercial
     * (percent : % de la part ; fixed : valeur proratée sur la part de la ligne).
     */
    public function calculateForPayment(Invoice $invoice, float $paidAmount, ?Commercial $commercial = null): array
    {
        if ($paidAmount <= 0 || $invoice->commercial_id === null) {
            return [];
        }

        $commercial ??= $invoice->commercial;

        if (! $commercial || $commercial->commission_type === 'none') {
            return [];
        }

        $invoiceTotal = (float) $invoice->total_amount;

        if ($invoiceTotal <= 0) {
            return [];
        }

        $invoice->loadMissing('items.service');

        return $invoice->items
            ->filter(fn (InvoiceItem $line) => (float) $line->line_total > 0)
            ->map(function (InvoiceItem $line) use ($paidAmount, $invoiceTotal, $commercial) {
                $lineShare = round($paidAmount * ((float) $line->line_total / $invoiceTotal), 2);
                $service = $line->service;

                // Prime fixe par service vendu : elle prime sur le pourcentage du commercial.
                if ($service && (float) $service->bonus_fixed > 0) {
                    return [
                        'service_id' => $service->id,
                        'amount' => round((float) $service->bonus_fixed * ($paidAmount / $invoiceTotal), 2),
                        'base_amount' => $lineShare,
                        'rule' => 'service_fixed',
                        'rate' => (float) $service->bonus_fixed,
                    ];
                }

                if ($commercial->commission_type === 'percent') {
                    return [
                        'service_id' => $service?->id,
                        'amount' => round(((float) $commercial->commission_value / 100) * $lineShare, 2),
                        'base_amount' => $lineShare,
                        'rule' => 'percent',
                        'rate' => (float) $commercial->commission_value,
                    ];
                }

                return [
                    'service_id' => $service?->id,
                    'amount' => round((float) $commercial->commission_value * ($lineShare / (float) $line->line_total), 2),
                    'base_amount' => $lineShare,
                    'rule' => 'fixed',
                    'rate' => (float) $commercial->commission_value,
                ];
            })
            ->filter(fn (array $row) => $row['amount'] > 0)
            ->values()
            ->all();
    }

    /**
     * Journalise les commissions d'un encaissement (idempotent par payment_id).
     * Moteur de règles versionnées en priorité ; puis commission du vendeur
     * (formateur / employé / commercial via profile vendeur) ; fallback commercial historique.
     */
    public function recordForPayment(Invoice $invoice, InvoicePayment $payment, ?string $actorUserId = null): void
    {
        if ($this->callEvaluateRulesForPayment($invoice, $payment, $actorUserId) > 0) {
            return;
        }

        if ($this->recordSellerFallback($invoice, $payment, $actorUserId) > 0) {
            return;
        }

        $this->recordFallback($invoice, $payment, $actorUserId);
    }

    /**
     * Évalue toutes les règles actives matchant le contexte de l'encaissement.
     * Retourne le nombre d'entrées créées.
     */
    public function callEvaluateRulesForPayment(Invoice $invoice, InvoicePayment $payment, ?string $actorUserId = null): int
    {
        $isFirstPayment = $invoice->payments()->where('id', '!=', $payment->id)->doesntExist();
        $becomesFullPaid = $invoice->status === 'paid';

        $rules = CommissionRule::query()
            ->active()
            ->where(fn ($q) => $q->whereNull('starts_on')->orWhere('starts_on', '<=', now()->toDateString()))
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', now()->toDateString()))
            ->where(function ($q) use ($isFirstPayment, $becomesFullPaid) {
                $q->where('trigger_event', CommissionRule::TRIGGER_ON_PAYMENT);
                if ($isFirstPayment) {
                    $q->orWhere('trigger_event', CommissionRule::TRIGGER_ON_SALE);
                }
                if ($becomesFullPaid) {
                    $q->orWhere('trigger_event', CommissionRule::TRIGGER_ON_FULL_PAYMENT);
                }
            })
            ->get()
            ->filter(fn (CommissionRule $rule) => $this->ruleMatchesInvoice($rule, $invoice));

        if ($rules->isEmpty()) {
            return 0;
        }

        return DB::transaction(function () use ($rules, $invoice, $payment, $actorUserId) {
            return $this->createEntries($rules, $invoice, $payment, $actorUserId);
        });
    }

private function createEntries($rules, Invoice $invoice, InvoicePayment $payment, ?string $actorUserId): int
    {
        $count = 0;

        foreach ($rules as $rule) {
            $sellerProfileId = $rule->beneficiary_seller_profile_id;
            $beneficiaryId = $sellerProfileId ? null : ($rule->beneficiary_commercial_id ?? $invoice->commercial_id);

            if (! $sellerProfileId && ! $beneficiaryId) {
                continue;
            }

            $base = $this->baseForRule($rule, $invoice, (float) $payment->amount);
            $amount = $rule->computeAmount($base);

            if ($amount <= 0) {
                continue;
            }

            if (CommissionEntry::where('invoice_payment_id', $payment->id)
                ->where('commission_rule_id', $rule->id)
                ->exists()) {
                continue;
            }

            $entryData = [
                'invoice_id' => $invoice->id,
                'invoice_payment_id' => $payment->id,
                'commission_rule_id' => $rule->id,
                'rule_snapshot' => $rule->snapshot(),
                'base_amount' => $base,
                'amount' => $amount,
                'status' => CommissionEntry::STATUS_CALCULATED,
            ];

            if ($sellerProfileId) {
                $entryData['seller_profile_id'] = $sellerProfileId;
                $entryData['beneficiary_commercial_id'] = null;
            } else {
                $entryData['beneficiary_commercial_id'] = $beneficiaryId;
            }

            if ($rule->course_id) {
                $entryData['category'] = 'training';
                $entryData['product_id'] = $rule->course_id;
                $entryData['product_type'] = 'course';
            } elseif ($rule->service_id) {
                $entryData['category'] = 'service';
                $entryData['product_id'] = $rule->service_id;
                $entryData['product_type'] = 'service';
            }

            CommissionEntry::create($entryData);

            $count++;

            $this->logger->log(
                action: 'commission',
                entityType: 'invoice',
                entityId: $invoice->id,
                description: "Commission de {$amount} FCFA (règle {$rule->name}) sur la facture {$invoice->number}",
                newValues: ['rule_id' => $rule->id, 'amount' => $amount, 'payment_id' => $payment->id],
            );
        }

        return $count;
    }

    private function ruleMatchesInvoice(CommissionRule $rule, Invoice $invoice): bool
    {
        if ($rule->scope_country_id) {
            $countryId = $invoice->agency?->country_id;
            if ($countryId === null || $countryId !== $rule->scope_country_id) {
                return false;
            }
        }

        if ($rule->scope_agency_id && $invoice->agency_id !== $rule->scope_agency_id) {
            return false;
        }

        if ($rule->scope_department_id && $this->resolveDepartmentForInvoice($invoice) !== $rule->scope_department_id) {
            return false;
        }

        if ($rule->service_id && ! $invoice->items()->where('service_id', $rule->service_id)->exists()) {
            return false;
        }

        if ($rule->course_id && ! FormationEnrollment::where('invoice_id', $invoice->id)
            ->where('course_id', $rule->course_id)
            ->exists()) {
            return false;
        }

        return true;
    }

    private function resolveDepartmentForInvoice(Invoice $invoice): ?string
    {
        $commercial = $invoice->commercial;

        if (! $commercial?->user) {
            return null;
        }

        $primary = $commercial->user->primaryAgency()->first();

        return $primary?->pivot->department_id
            ?? $commercial->user->assignments()->first()?->pivot->department_id;
    }

    private function baseForRule(CommissionRule $rule, Invoice $invoice, float $paidAmount): float
    {
        if (! $rule->service_id && ! $rule->course_id) {
            return $paidAmount;
        }

        if ($rule->course_id) {
            // Facture d'inscription à une formation : la ligne est liée via formation_enrollments.
            return $paidAmount;
        }

        $invoiceTotal = (float) $invoice->total_amount;
        if ($invoiceTotal <= 0) {
            return 0.0;
        }

        $targetedLineTotal = (float) $invoice->items()->where('service_id', $rule->service_id)->sum('line_total');

        return round($paidAmount * ($targetedLineTotal / $invoiceTotal), 2);
    }

    /**
     * Détermine le vendeur réel d'une facture et son profil de commission :
     * 1. utilisateur vendeur (seller_user_id) → profil vendeur lié à ce compte ;
     * 2. formateur sans compte (seller_trainer_id) → profil vendeur de type formateur ;
     * 3. retourne null (le fallback commercial historique prend ensuite le relais).
     */
    private function resolveSellerProfile(Invoice $invoice): ?SellerProfile
    {
        $sellerUserId = $invoice->seller_user_id;

        if ($sellerUserId === null) {
            $enrollment = FormationEnrollment::query()
                ->where('invoice_id', $invoice->id)
                ->whereNotNull('seller_trainer_id')
                ->first();

            $trainerUserId = $enrollment?->sellerTrainer?->user_id;

            if (! $trainerUserId) {
                return null;
            }

            $sellerUserId = $trainerUserId;
        }

        $profiles = SellerProfile::query()
            ->where('user_id', $sellerUserId)
            ->where('is_active', true)
            ->get();

        if ($invoice->agency_id) {
            $agencyMatch = $profiles->firstWhere('agency_id', $invoice->agency_id);

            if ($agencyMatch) {
                return $agencyMatch;
            }
        }

        return $profiles->first();
    }

    /**
     * Commission automatique du vendeur réel (profil vendeur) à défaut de règle.
     * Enregistre une CommissionEntry calculée par ligne, sans jamais excéder la
     * part de paiement de chaque ligne, et la commission du profil (percent/fixed)
     * ou la prime fixe du service si elle prime.
     *
     * @return int nombre d'entrées créées
     */
    private function recordSellerFallback(Invoice $invoice, InvoicePayment $payment, ?string $actorUserId = null): int
    {
        $profile = $this->resolveSellerProfile($invoice);

        if (! $profile || $profile->commission_type === 'none') {
            return 0;
        }

        if (CommissionEntry::query()
            ->where('invoice_payment_id', $payment->id)
            ->whereNull('commission_rule_id')
            ->exists()) {
            return 0;
        }

        $rows = $this->calculateProfileRows($invoice, $profile, (float) $payment->amount);

        if (empty($rows)) {
            return 0;
        }

        return DB::transaction(function () use ($invoice, $payment, $profile, $rows, $actorUserId) {
            $total = 0.0;

            foreach ($rows as $row) {
                $total += $row['amount'];

                CommissionEntry::create([
                    'invoice_id' => $invoice->id,
                    'invoice_payment_id' => $payment->id,
                    'commission_rule_id' => null,
                    'rule_snapshot' => null,
                    'seller_profile_id' => $profile->id,
                    'beneficiary_commercial_id' => null,
                    'base_amount' => $row['base_amount'],
                    'amount' => $row['amount'],
                    'category' => $row['category'],
                    'product_id' => $row['product_id'],
                    'product_type' => $row['product_type'],
                    'status' => CommissionEntry::STATUS_CALCULATED,
                ]);

                $this->logger->log(
                    action: 'commission',
                    entityType: 'invoice',
                    entityId: $invoice->id,
                    description: "Commission de {$row['amount']} FCFA (vendeur {$profile->kind}) sur la facture {$invoice->number}",
                    newValues: ['seller_profile_id' => $profile->id, 'amount' => $row['amount'], 'payment_id' => $payment->id],
                );
            }

            $total = round($total, 2);

            if ($invoice->commission_amount === null) {
                $invoice->update(['commission_amount' => $total]);
            } else {
                $invoice->increment('commission_amount', $total);
            }

            return count($rows);
        });
    }

    /**
     * Parts de commission d'un profil vendeur pour un encaissement (multi-lignes).
     */
    private function calculateProfileRows(Invoice $invoice, SellerProfile $profile, float $paidAmount): array
    {
        $invoiceTotal = (float) $invoice->total_amount;

        if ($invoiceTotal <= 0) {
            return [];
        }

        $enrollment = FormationEnrollment::query()
            ->where('invoice_id', $invoice->id)
            ->whereNotNull('course_id')
            ->first();

        $courseId = $enrollment?->course_id;

        $invoice->loadMissing('items.service');

        return $invoice->items
            ->filter(fn (InvoiceItem $line) => (float) $line->line_total > 0)
            ->map(function (InvoiceItem $line) use ($paidAmount, $invoiceTotal, $profile, $courseId) {
                $lineShare = round($paidAmount * ((float) $line->line_total / $invoiceTotal), 2);
                $service = $line->service;

                // Prime fixe par service vendu : elle prime sur la commission du vendeur.
                if ($service && (float) $service->bonus_fixed > 0) {
                    $amount = round((float) $service->bonus_fixed * ($paidAmount / $invoiceTotal), 2);
                } else {
                    $amount = $profile->computeCommission($lineShare);
                }

                if ($service?->id) {
                    $category = 'service';
                    $productId = $service->id;
                    $productType = 'service';
                } elseif ($courseId) {
                    $category = 'training';
                    $productId = $courseId;
                    $productType = 'course';
                } else {
                    $category = 'service';
                    $productId = null;
                    $productType = null;
                }

                return [
                    'category' => $category,
                    'product_id' => $productId,
                    'product_type' => $productType,
                    'base_amount' => $lineShare,
                    'amount' => $amount,
                ];
            })
            ->filter(fn (array $row) => $row['amount'] > 0)
            ->values()
            ->all();
    }

    private function recordFallback(Invoice $invoice, InvoicePayment $payment, ?string $actorUserId = null): void
    {
        $rows = $this->calculateForPayment($invoice, (float) $payment->amount);

        if (empty($rows)) {
            return;
        }

        $hasLegacy = CommissionPayment::where('payment_id', $payment->id)->exists();
        $hasEntries = CommissionEntry::query()
            ->where('invoice_payment_id', $payment->id)
            ->whereNull('commission_rule_id')
            ->exists();

        if ($hasLegacy && $hasEntries) {
            return;
        }

        DB::transaction(function () use ($invoice, $payment, $rows, $actorUserId, $hasLegacy, $hasEntries) {
            $total = 0.0;

            foreach ($rows as $row) {
                $total += $row['amount'];

                // Entrée due (visible dans les soldes et payable manuellement).
                if (! $hasEntries) {
                    CommissionEntry::create([
                        'invoice_id' => $invoice->id,
                        'invoice_payment_id' => $payment->id,
                        'commission_rule_id' => null,
                        'rule_snapshot' => null,
                        'beneficiary_commercial_id' => $invoice->commercial_id,
                        'seller_profile_id' => null,
                        'base_amount' => $row['base_amount'],
                        'amount' => $row['amount'],
                        'category' => 'service',
                        'product_id' => $row['service_id'],
                        'product_type' => $row['service_id'] ? 'service' : null,
                        'status' => CommissionEntry::STATUS_CALCULATED,
                    ]);
                }

                // Crédit historique (reporting, détail facture, idempotence).
                if (! $hasLegacy) {
                    CommissionPayment::create(array_merge($row, [
                        'commercial_id' => $invoice->commercial_id,
                        'invoice_id' => $invoice->id,
                        'payment_id' => $payment->id,
                        'invoice_total' => (float) $invoice->total_amount,
                        'created_by' => $actorUserId,
                    ]));
                }
            }

            $total = round($total, 2);

            if ($invoice->commission_amount === null) {
                $invoice->update(['commission_amount' => $total]);
            } else {
                $invoice->increment('commission_amount', $total);
            }
        });
    }
}