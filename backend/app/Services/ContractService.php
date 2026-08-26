<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\ContractService as ContractServiceModel;
use App\Models\Setting;
use Illuminate\Support\Carbon;

class ContractService
{
    public function __construct(
        private readonly ActivityLogger $logger,
    ) {}

    public function generateNextNumber(): string
    {
        $last = Contract::withTrashed()->orderByDesc('number')->value('number');
        $next = $last ? ((int) substr($last, 4)) + 1 : 1;

        return 'CTR-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }

    public function markDueSoon(): int
    {
        $alertDays = $this->getRenewAlertDays();
        $threshold = today()->addDays(max($alertDays));

        $contracts = Contract::where('status', Contract::STATUS_ACTIVE)
            ->whereDate('end_date', '<=', $threshold)
            ->whereDate('end_date', '>=', today())
            ->get();

        $count = 0;

        foreach ($contracts as $contract) {
            $contract->update(['status' => Contract::STATUS_DUE_SOON]);

            $this->logger->log(
                action: 'status_changed',
                entityType: 'contract',
                entityId: $contract->id,
                description: "Contrat {$contract->number} marqué « bientôt expiré »",
                oldValues: ['status' => Contract::STATUS_ACTIVE],
                newValues: ['status' => Contract::STATUS_DUE_SOON],
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
            );

            $count++;
        }

        return $count;
    }

    public function renew(Contract $contract): Contract
    {
        $startDate = today();
        $endDate = $this->calculateEndDate($startDate, $contract->billing_cycle);

        $newContract = Contract::create([
            'number' => self::generateNextNumber(),
            'client_id' => $contract->client_id,
            'company_id' => $contract->company_id,
            'agency_id' => $contract->agency_id,
            'department_id' => $contract->department_id,
            'pack_id' => $contract->pack_id,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'billing_cycle' => $contract->billing_cycle,
            'amount' => $contract->amount,
            'status' => Contract::STATUS_ACTIVE,
            'auto_renew' => $contract->auto_renew,
            'renewal_count' => $contract->renewal_count + 1,
            'parent_contract_id' => $contract->id,
            'notes' => $contract->notes,
        ]);

        $originalServices = ContractServiceModel::where('contract_id', $contract->id)->get();

        foreach ($originalServices as $originalService) {
            ContractServiceModel::create([
                'contract_id' => $newContract->id,
                'service_id' => $originalService->service_id,
                'price' => $originalService->price,
            ]);
        }

        return $newContract;
    }

    public function terminate(Contract $contract, string $reason): Contract
    {
        $contract->update([
            'status' => Contract::STATUS_TERMINATED,
            'terminated_at' => now(),
            'terminated_reason' => $reason,
        ]);

        return $contract->fresh();
    }

    public function getRenewAlertDays(): array
    {
        $setting = Setting::where('key', 'contract_renew_alert_days')->value('value');

        if (is_array($setting)) {
            return $setting;
        }

        return [30, 7];
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
