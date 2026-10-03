<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Prestation;
use App\Models\SubscriptionPack;
use Illuminate\Support\Facades\DB;

/**
 * Renouvellement d'un contrat Agency : nouveau contrat enfant `pending` +
 * sa facture (sinon il ne pourrait jamais être activé, D10).
 * - package : nouvelle prestation pré-remplie pour la nouvelle période (D3) ;
 * - prestation : la prestation continue, rattachée au nouveau contrat et prolongée.
 */
class AgencyRenewalService
{
    public function __construct(
        private readonly ContractService $contracts,
        private readonly AgencyInvoicingService $invoicing,
        private readonly PackageService $packages,
    ) {}

    public function renew(Contract $contract, ?string $actorUserId): Contract
    {
        return DB::transaction(function () use ($contract, $actorUserId) {
            $child = $this->contracts->renew($contract);

            if ($contract->origin === Contract::ORIGIN_PACKAGE && $contract->pack_id) {
                $package = SubscriptionPack::with('items')->findOrFail($contract->pack_id);
                $this->packages->generatePrestation($package, $child, $actorUserId);
                $this->invoicing->invoiceForPackage($child, $package, 1, (float) $child->amount, $actorUserId);
            }

            if ($contract->origin === Contract::ORIGIN_PRESTATION && $contract->prestation_id) {
                $prestation = Prestation::findOrFail($contract->prestation_id);
                $child->update(['prestation_id' => $prestation->id]);
                $prestation->update(['contract_id' => $child->id, 'end_date' => $child->end_date->toDateString()]);
                $this->invoicing->invoiceForPrestation($child, $prestation->fresh(), $actorUserId);
            }

            return $child->fresh();
        });
    }
}
