<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Prestation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Prestations Agency : création, workflow de statuts (motif obligatoire pour
 * rejet / suspension / annulation) et validation ⇒ contrat + facture (D9).
 */
class PrestationService
{
    public function __construct(
        private readonly ContractService $contracts,
        private readonly AgencyInvoicingService $invoicing,
        private readonly ActivityLogger $logger,
    ) {}

    public function create(array $data, User $actor): Prestation
    {
        $prestation = Prestation::create($data + [
            'reference' => Prestation::generateReference(),
            'status' => Prestation::STATUS_DRAFT,
            'created_by' => $actor->id,
        ]);

        $this->logger->log(
            action: 'created',
            entityType: 'prestation',
            entityId: $prestation->id,
            description: "Prestation {$prestation->reference} « {$prestation->name} » créée",
            newValues: ['budget' => (float) $prestation->budget],
            agencyId: $prestation->agency_id,
        );

        return $prestation;
    }

    public function update(Prestation $prestation, array $data): Prestation
    {
        if (in_array($prestation->status, [Prestation::STATUS_COMPLETED, Prestation::STATUS_CANCELLED], true)) {
            throw ValidationException::withMessages(['status' => 'Une prestation terminée ou annulée ne peut plus être modifiée.']);
        }

        // D4 : le budget ne peut pas descendre sous la somme déjà allouée aux actions.
        if (array_key_exists('budget', $data) && (float) $data['budget'] < $prestation->budget_allocated) {
            throw ValidationException::withMessages([
                'budget' => "Le budget ne peut pas être inférieur au budget déjà alloué aux actions ({$prestation->budget_allocated} FCFA).",
            ]);
        }

        // Une fois le contrat créé, le budget contractuel est figé.
        if ($prestation->contract_id && array_key_exists('budget', $data) && (float) $data['budget'] !== (float) $prestation->budget) {
            throw ValidationException::withMessages([
                'budget' => 'Le budget est figé par le contrat : il ne peut plus être modifié.',
            ]);
        }

        $old = $prestation->only(array_keys($data));
        $prestation->update($data);

        $this->logger->log(
            action: 'updated',
            entityType: 'prestation',
            entityId: $prestation->id,
            description: "Prestation {$prestation->reference} modifiée",
            oldValues: $old,
            newValues: $data,
            agencyId: $prestation->agency_id,
        );

        return $prestation->fresh();
    }

    public function submit(Prestation $prestation): Prestation
    {
        return $this->transition($prestation, Prestation::STATUS_PENDING_VALIDATION);
    }

    /** D9 : la validation (chef d'agence / direction) crée le contrat et sa facture. */
    public function validate(Prestation $prestation, User $actor): Prestation
    {
        return DB::transaction(function () use ($prestation, $actor) {
            $prestation = $this->transition($prestation, Prestation::STATUS_VALIDATED);

            $prestation->update(['validated_by' => $actor->id, 'validated_at' => now()]);

            if (! $prestation->contract_id) {
                $contract = $this->contracts->createFromPrestation($prestation);
                $this->invoicing->invoiceForPrestation($contract, $prestation->fresh(), $actor->id);
            }

            return $prestation->fresh();
        });
    }

    public function reject(Prestation $prestation, string $reason): Prestation
    {
        return $this->transition($prestation, Prestation::STATUS_REJECTED, $reason);
    }

    public function backToDraft(Prestation $prestation): Prestation
    {
        return $this->transition($prestation, Prestation::STATUS_DRAFT);
    }

    public function start(Prestation $prestation): Prestation
    {
        return $this->transition($prestation, Prestation::STATUS_IN_PROGRESS);
    }

    public function suspend(Prestation $prestation, string $reason): Prestation
    {
        return DB::transaction(function () use ($prestation, $reason) {
            $prestation = $this->transition($prestation, Prestation::STATUS_SUSPENDED, $reason);

            $contract = $prestation->contract;
            if ($contract && ! in_array($contract->status, [Contract::STATUS_TERMINATED, Contract::STATUS_SUSPENDED], true)) {
                $this->contracts->suspend($contract, $reason);
            }

            return $prestation;
        });
    }

    /** Reprise d'une prestation suspendue (et de son contrat). */
    public function resume(Prestation $prestation): Prestation
    {
        return DB::transaction(function () use ($prestation) {
            $prestation = $this->transition($prestation, Prestation::STATUS_IN_PROGRESS);

            $contract = $prestation->contract;
            if ($contract && $contract->status === Contract::STATUS_SUSPENDED) {
                $this->contracts->resume($contract);
            }

            return $prestation;
        });
    }

    public function cancel(Prestation $prestation, string $reason): Prestation
    {
        return DB::transaction(function () use ($prestation, $reason) {
            $prestation = $this->transition($prestation, Prestation::STATUS_CANCELLED, $reason);

            $contract = $prestation->contract;
            if ($contract && $contract->status !== Contract::STATUS_TERMINATED) {
                $this->contracts->terminate($contract, $reason);
            }

            return $prestation;
        });
    }

    public function complete(Prestation $prestation): Prestation
    {
        return $this->transition($prestation, Prestation::STATUS_COMPLETED);
    }

    /**
     * Applique une transition contrôlée (table Prestation::TRANSITIONS) avec
     * motif obligatoire pour les statuts qui l'exigent.
     */
    public function transition(Prestation $prestation, string $status, ?string $reason = null): Prestation
    {
        if (! $prestation->canTransitionTo($status)) {
            throw ValidationException::withMessages([
                'status' => "Transition impossible : {$prestation->status} → {$status}.",
            ]);
        }

        $reason = $reason !== null ? trim($reason) : null;

        if (in_array($status, Prestation::STATUSES_REQUIRING_REASON, true) && ! $reason) {
            throw ValidationException::withMessages(['reason' => 'Un motif est obligatoire pour ce statut.']);
        }

        $oldStatus = $prestation->status;

        $prestation->update([
            'status' => $status,
            'status_reason' => in_array($status, Prestation::STATUSES_REQUIRING_REASON, true) ? $reason : null,
        ]);

        $this->logger->log(
            action: 'status_changed',
            entityType: 'prestation',
            entityId: $prestation->id,
            description: "Prestation {$prestation->reference} : {$oldStatus} → {$status}".($reason ? " ({$reason})" : ''),
            oldValues: ['status' => $oldStatus],
            newValues: ['status' => $status, 'reason' => $reason],
            agencyId: $prestation->agency_id,
        );

        return $prestation->fresh();
    }
}
