<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\ContractService as ContractServiceModel;
use App\Models\Invoice;
use App\Models\Prestation;
use App\Models\Setting;
use App\Models\SubscriptionPack;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ContractService
{
    /** D8 : délais d'alerte par défaut (jours avant l'échéance). */
    public const DEFAULT_RENEW_ALERT_DAYS = [30, 15, 7, 1];

    public function __construct(
        private readonly ActivityLogger $logger,
    ) {}

    public function generateNextNumber(): string
    {
        return DB::transaction(function () {
            // Verrou conseil PostgreSQL : exclusion mutuelle sur la séquence CTR-XXXXX.
            if (DB::getDriverName() === 'pgsql') {
                DB::select('SELECT pg_advisory_xact_lock(?)', [$this->numberLockKey()]);
            }

            $max = 0;
            $numbers = Contract::withTrashed()->where('number', 'like', 'CTR-%')->pluck('number');
            foreach ($numbers as $number) {
                // N'ignore que les numéros normalisés (les références
                // atypiques type CTR-TEST-0001 ne faussent pas la séquence).
                if (preg_match('/^CTR-(\d+)$/', (string) $number, $matches)) {
                    $max = max($max, (int) $matches[1]);
                }
            }

            return 'CTR-'.str_pad((string) ($max + 1), 5, '0', STR_PAD_LEFT);
        });
    }

    private function numberLockKey(): int
    {
        return crc32('contract:number');
    }

    /**
     * Validation d'une prestation ⇒ contrat liant Pekegno (agence), le client et
     * la prestation, avec le budget alloué. Le contrat attend le premier paiement (D10).
     */
    public function createFromPrestation(Prestation $prestation): Contract
    {
        $contract = DB::transaction(function () use ($prestation) {
            return Contract::create([
                'number' => $this->generateNextNumber(),
                'client_id' => $prestation->client_id,
                'company_id' => $prestation->company_id,
                'agency_id' => $prestation->agency_id,
                'department_id' => $prestation->department_id,
                'pack_id' => $prestation->package_id,
                'origin' => Contract::ORIGIN_PRESTATION,
                'prestation_id' => $prestation->id,
                'commercial_id' => $prestation->commercial_id,
                'start_date' => $prestation->start_date->toDateString(),
                'end_date' => $prestation->end_date->toDateString(),
                'billing_cycle' => 'one_shot',
                'amount' => $prestation->budget,
                'budget_allocated' => $prestation->budget,
                'status' => Contract::STATUS_PENDING,
                'auto_renew' => false,
            ]);
        });

        $prestation->update(['contract_id' => $contract->id]);

        $this->logger->log(
            action: 'created',
            entityType: 'contract',
            entityId: $contract->id,
            description: "Contrat {$contract->number} créé à la validation de la prestation {$prestation->reference}",
            newValues: ['origin' => Contract::ORIGIN_PRESTATION, 'amount' => (float) $prestation->budget],
            agencyId: $contract->agency_id,
        );

        return $contract;
    }

    /**
     * Souscription à un package ⇒ un nouveau contrat par package (D1).
     */
    public function createFromPackage(
        SubscriptionPack $package,
        string $clientId,
        Carbon $start,
        int $periods,
        float $unitPrice,
        ?string $commercialId,
        ?string $departmentId,
        bool $autoRenew = false,
    ): Contract {
        $end = $this->endDateFor($start, $package->billing_period ?? 'monthly', $periods);

        $contract = Contract::create([
            'number' => $this->generateNextNumber(),
            'client_id' => $clientId,
            'agency_id' => $package->agency_id,
            'department_id' => $departmentId ?? $package->department_id,
            'pack_id' => $package->id,
            'origin' => Contract::ORIGIN_PACKAGE,
            'commercial_id' => $commercialId,
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'billing_cycle' => $package->billing_period ?? 'monthly',
            'amount' => round($unitPrice * $periods, 2),
            'budget_allocated' => round($unitPrice * $periods, 2),
            'status' => Contract::STATUS_PENDING,
            'auto_renew' => $autoRenew,
        ]);

        $this->logger->log(
            action: 'created',
            entityType: 'contract',
            entityId: $contract->id,
            description: "Contrat {$contract->number} créé par souscription au package {$package->name}",
            newValues: ['origin' => Contract::ORIGIN_PACKAGE, 'amount' => (float) $contract->amount, 'periods' => $periods],
            agencyId: $contract->agency_id,
        );

        return $contract;
    }

    /**
     * D10 : le premier paiement validé d'une facture du contrat le fait passer
     * `pending → active` (et la prestation liée `validated → in_progress`).
     * Le PDF signé n'est pas requis.
     */
    public function activateOnFirstPayment(Invoice $invoice): ?Contract
    {
        if (! $invoice->contract_id) {
            return null;
        }

        if (($invoice->validation_status ?? Invoice::VALIDATION_VALIDATED) !== Invoice::VALIDATION_VALIDATED) {
            return null;
        }

        $contract = Contract::find($invoice->contract_id);

        if (! $contract || ! in_array($contract->status, [Contract::STATUS_PENDING, Contract::STATUS_DRAFT], true)) {
            return $contract;
        }

        if (! $invoice->payments()->exists()) {
            return $contract;
        }

        $contract->update([
            'status' => Contract::STATUS_ACTIVE,
            'activated_at' => now(),
        ]);

        $this->logger->log(
            action: 'status_changed',
            entityType: 'contract',
            entityId: $contract->id,
            description: "Contrat {$contract->number} activé au premier paiement (facture {$invoice->number})",
            oldValues: ['status' => Contract::STATUS_PENDING],
            newValues: ['status' => Contract::STATUS_ACTIVE],
            agencyId: $contract->agency_id,
        );

        $prestation = $contract->prestation_id ? Prestation::find($contract->prestation_id) : null;

        if ($prestation && $prestation->status === Prestation::STATUS_VALIDATED) {
            $prestation->update(['status' => Prestation::STATUS_IN_PROGRESS]);

            $this->logger->log(
                action: 'status_changed',
                entityType: 'prestation',
                entityId: $prestation->id,
                description: "Prestation {$prestation->reference} démarrée (contrat {$contract->number} activé)",
                oldValues: ['status' => Prestation::STATUS_VALIDATED],
                newValues: ['status' => Prestation::STATUS_IN_PROGRESS],
                agencyId: $prestation->agency_id,
            );
        }

        return $contract->fresh();
    }

    /**
     * Passe « à renouveler » les contrats actifs dont l'échéance entre dans la
     * plus grande fenêtre d'alerte.
     */
    public function markDueSoon(): int
    {
        $count = 0;

        $contracts = Contract::where('status', Contract::STATUS_ACTIVE)
            ->whereDate('end_date', '>=', today())
            ->get();

        foreach ($contracts as $contract) {
            $threshold = today()->addDays(max($this->getRenewAlertDays($contract->department_id)));

            if ($contract->end_date->gt($threshold)) {
                continue;
            }

            $contract->update(['status' => Contract::STATUS_DUE_SOON]);

            $this->logger->log(
                action: 'status_changed',
                entityType: 'contract',
                entityId: $contract->id,
                description: "Contrat {$contract->number} marqué « à renouveler »",
                oldValues: ['status' => Contract::STATUS_ACTIVE],
                newValues: ['status' => Contract::STATUS_DUE_SOON],
                agencyId: $contract->agency_id,
            );

            $count++;
        }

        return $count;
    }

    public function markExpired(): int
    {
        $contracts = Contract::whereIn('status', [Contract::STATUS_ACTIVE, Contract::STATUS_DUE_SOON])
            ->whereDate('end_date', '<', today())
            ->get();

        $count = 0;

        foreach ($contracts as $contract) {
            $oldStatus = $contract->status;
            $contract->update(['status' => Contract::STATUS_EXPIRED]);

            $this->logger->log(
                action: 'status_changed',
                entityType: 'contract',
                entityId: $contract->id,
                description: "Contrat {$contract->number} expiré",
                oldValues: ['status' => $oldStatus],
                newValues: ['status' => Contract::STATUS_EXPIRED],
                agencyId: $contract->agency_id,
            );

            $count++;
        }

        return $count;
    }

    /**
     * Renouvellement : nouveau contrat enfant pour la période suivante ; le
     * contrat d'origine passe `renewed`. Un contrat Agency (package/prestation)
     * repart en `pending` jusqu'au paiement de sa nouvelle facture (D10).
     */
    public function renew(Contract $contract): Contract
    {
        $isAgency = in_array($contract->origin, [Contract::ORIGIN_PACKAGE, Contract::ORIGIN_PRESTATION], true);
        $startDate = $isAgency && $contract->end_date->gte(today())
            ? $contract->end_date->copy()->addDay()
            : today();
        $endDate = $contract->billing_cycle === 'one_shot'
            ? $startDate->copy()->addDays(max(1, $contract->start_date->diffInDays($contract->end_date)))
            : $this->calculateEndDate($startDate, $contract->billing_cycle);

        $newContract = DB::transaction(function () use ($contract, $startDate, $endDate, $isAgency) {
            return Contract::create([
                'number' => $this->generateNextNumber(),
                'client_id' => $contract->client_id,
                'company_id' => $contract->company_id,
                'agency_id' => $contract->agency_id,
                'department_id' => $contract->department_id,
                'pack_id' => $contract->pack_id,
                'origin' => $contract->origin ?? Contract::ORIGIN_MANUAL,
                'commercial_id' => $contract->commercial_id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'billing_cycle' => $contract->billing_cycle,
                'amount' => $contract->amount,
                'budget_allocated' => $contract->budget_allocated,
                'status' => $isAgency ? Contract::STATUS_PENDING : Contract::STATUS_ACTIVE,
                'auto_renew' => $contract->auto_renew,
                'renewal_count' => $contract->renewal_count + 1,
                'parent_contract_id' => $contract->id,
                'notes' => $contract->notes,
            ]);
        });

        $originalServices = ContractServiceModel::where('contract_id', $contract->id)->get();

        foreach ($originalServices as $originalService) {
            ContractServiceModel::create([
                'contract_id' => $newContract->id,
                'service_id' => $originalService->service_id,
                'price' => $originalService->price,
            ]);
        }

        if ($isAgency) {
            $contract->update(['status' => Contract::STATUS_RENEWED]);
        }

        $this->logger->log(
            action: 'renewed',
            entityType: 'contract',
            entityId: $contract->id,
            description: "Contrat {$contract->number} renouvelé → {$newContract->number}",
            newValues: ['child' => $newContract->number],
            agencyId: $contract->agency_id,
        );

        return $newContract;
    }

    /**
     * Une facture d'abonnement (package) annulée/rejetée avant l'activation
     * invalide la souscription : on résilie le contrat encore en attente et sa
     * prestation liée pour que le client puisse souscrire de nouveau au package.
     */
    public function cancelPendingForInvoice(Invoice $invoice, string $reason): void
    {
        if (! $invoice->contract_id) {
            return;
        }

        $contract = Contract::find($invoice->contract_id);

        if (! $contract || ! in_array($contract->status, [Contract::STATUS_PENDING, Contract::STATUS_DRAFT], true)) {
            return;
        }

        $this->terminate($contract, $reason);

        if ($contract->prestation_id) {
            Prestation::whereKey($contract->prestation_id)->update(['status' => Prestation::STATUS_CANCELLED]);
        }
    }

    public function terminate(Contract $contract, string $reason): Contract
    {
        $oldStatus = $contract->status;

        $contract->update([
            'status' => Contract::STATUS_TERMINATED,
            'terminated_at' => now(),
            'terminated_reason' => $reason,
        ]);

        $this->logger->log(
            action: 'terminated',
            entityType: 'contract',
            entityId: $contract->id,
            description: "Contrat {$contract->number} résilié : {$reason}",
            oldValues: ['status' => $oldStatus],
            newValues: ['status' => Contract::STATUS_TERMINATED, 'reason' => $reason],
            agencyId: $contract->agency_id,
        );

        return $contract->fresh();
    }

    public function suspend(Contract $contract, string $reason): Contract
    {
        $oldStatus = $contract->status;

        $contract->update([
            'status' => Contract::STATUS_SUSPENDED,
            'suspended_reason' => $reason,
        ]);

        $this->logger->log(
            action: 'status_changed',
            entityType: 'contract',
            entityId: $contract->id,
            description: "Contrat {$contract->number} suspendu : {$reason}",
            oldValues: ['status' => $oldStatus],
            newValues: ['status' => Contract::STATUS_SUSPENDED, 'reason' => $reason],
            agencyId: $contract->agency_id,
        );

        return $contract->fresh();
    }

    /** Reprise d'un contrat suspendu : actif s'il a déjà été activé, sinon en attente. */
    public function resume(Contract $contract): Contract
    {
        $status = $contract->activated_at ? Contract::STATUS_ACTIVE : Contract::STATUS_PENDING;

        $contract->update(['status' => $status, 'suspended_reason' => null]);

        $this->logger->log(
            action: 'status_changed',
            entityType: 'contract',
            entityId: $contract->id,
            description: "Contrat {$contract->number} repris",
            oldValues: ['status' => Contract::STATUS_SUSPENDED],
            newValues: ['status' => $status],
            agencyId: $contract->agency_id,
        );

        return $contract->fresh();
    }

    /**
     * D8 : délais d'alerte (jours) — réglage du département s'il existe
     * (`agency_renew_alert_days:{departmentId}`), sinon réglage global, sinon J-30/15/7/1.
     *
     * @return array<int, int>
     */
    public function getRenewAlertDays(?string $departmentId = null): array
    {
        $candidates = [];

        if ($departmentId) {
            $candidates[] = Setting::where('key', "agency_renew_alert_days:{$departmentId}")->value('value');
        }

        $candidates[] = Setting::where('key', 'contract_renew_alert_days')->value('value');

        foreach ($candidates as $value) {
            if (is_array($value) && $value !== []) {
                $days = array_values(array_unique(array_map('intval', $value)));
                rsort($days);

                return $days;
            }
        }

        return self::DEFAULT_RENEW_ALERT_DAYS;
    }

    public function endDateFor(Carbon $start, string $billingPeriod, int $periods): Carbon
    {
        $months = (SubscriptionPack::PERIOD_MONTHS[$billingPeriod] ?? 1) * max(1, $periods);

        return $start->copy()->addMonthsNoOverflow($months)->subDay();
    }

    private function calculateEndDate(Carbon $startDate, string $billingCycle): Carbon
    {
        return match ($billingCycle) {
            'monthly' => $startDate->copy()->addMonth(),
            'quarterly' => $startDate->copy()->addMonths(3),
            'yearly' => $startDate->copy()->addYear(),
            default => $startDate->copy(),
        };
    }
}
