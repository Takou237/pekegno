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
     * Moteur de règles versionnées en priorité ; fallback historique sinon.
     */
    public function recordForPayment(Invoice $invoice, InvoicePayment $payment, ?string $actorUserId = null): void
    {
        if ($this->callEvaluateRulesForPayment($invoice, $payment, $actorUserId) > 0) {
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

    private function recordFallback(Invoice $invoice, InvoicePayment $payment, ?string $actorUserId = null): void
    {
        if (CommissionPayment::where('payment_id', $payment->id)->exists()) {
            return;
        }

        $rows = $this->calculateForPayment($invoice, (float) $payment->amount);

        if (empty($rows)) {
            return;
        }

        DB::transaction(function () use ($invoice, $payment, $rows, $actorUserId) {
            $total = 0.0;

            foreach ($rows as $row) {
                $total += $row['amount'];

                CommissionPayment::create(array_merge($row, [
                    'commercial_id' => $invoice->commercial_id,
                    'invoice_id' => $invoice->id,
                    'payment_id' => $payment->id,
                    'invoice_total' => (float) $invoice->total_amount,
                    'created_by' => $actorUserId,
                ]));
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