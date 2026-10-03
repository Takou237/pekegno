<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Subscription;
use Illuminate\Support\Facades\DB;

/**
 * D16 : reprise de TOUT l'historique `subscriptions → contracts`.
 * Idempotente : une souscription déjà reprise (contracts.legacy_subscription_id)
 * est ignorée ; la commande peut être rejouée sans doublon.
 */
class SubscriptionMigrationService
{
    /** Correspondance des statuts d'abonnement vers les statuts de contrat. */
    public const STATUS_MAP = [
        'draft' => Contract::STATUS_DRAFT,
        'pending' => Contract::STATUS_PENDING,
        'active' => Contract::STATUS_ACTIVE,
        'suspended' => Contract::STATUS_SUSPENDED,
        'expired' => Contract::STATUS_EXPIRED,
        'cancelled' => Contract::STATUS_TERMINATED,
        'renewed' => Contract::STATUS_RENEWED,
    ];

    public function __construct(private readonly ContractService $contracts) {}

    /**
     * @return array{migrated: int, skipped: int, anomalies: array<int, string>}
     */
    public function migrate(bool $dryRun = false): array
    {
        $migrated = 0;
        $skipped = 0;
        $anomalies = [];

        $alreadyMigrated = Contract::withTrashed()->whereNotNull('legacy_subscription_id')->pluck('legacy_subscription_id')->flip();

        Subscription::query()->with('pack')->orderBy('start_date')->chunk(200, function ($subscriptions) use (&$migrated, &$skipped, &$anomalies, $alreadyMigrated, $dryRun) {
            foreach ($subscriptions as $subscription) {
                if ($alreadyMigrated->has($subscription->id)) {
                    $skipped++;

                    continue;
                }

                if (! $subscription->client_id || ! $subscription->agency_id) {
                    $anomalies[] = "Abonnement {$subscription->id} : client ou agence manquant — non repris.";

                    continue;
                }

                $status = self::STATUS_MAP[$subscription->status] ?? null;
                if ($status === null) {
                    $anomalies[] = "Abonnement {$subscription->id} : statut inconnu « {$subscription->status} » — repris en « expired ».";
                    $status = Contract::STATUS_EXPIRED;
                }

                // Un abonnement « actif » dont la date est passée est en réalité expiré.
                if (in_array($status, [Contract::STATUS_ACTIVE, Contract::STATUS_PENDING], true) && $subscription->end_date?->lt(today())) {
                    $status = Contract::STATUS_EXPIRED;
                }

                if ($dryRun) {
                    $migrated++;

                    continue;
                }

                DB::transaction(function () use ($subscription, $status) {
                    $contract = Contract::create([
                        'number' => $this->contracts->generateNextNumber(),
                        'client_id' => $subscription->client_id,
                        'agency_id' => $subscription->agency_id,
                        'department_id' => $subscription->pack?->department_id,
                        'pack_id' => $subscription->subscription_pack_id,
                        'origin' => Contract::ORIGIN_PACKAGE,
                        'start_date' => $subscription->start_date->toDateString(),
                        'end_date' => $subscription->end_date->toDateString(),
                        'billing_cycle' => 'monthly',
                        'amount' => $subscription->total_price,
                        'budget_allocated' => $subscription->total_price,
                        'status' => $status,
                        'activated_at' => in_array($status, [Contract::STATUS_PENDING, Contract::STATUS_DRAFT], true) ? null : $subscription->start_date,
                        'terminated_at' => $status === Contract::STATUS_TERMINATED ? ($subscription->cancelled_at ?? now()) : null,
                        'terminated_reason' => $status === Contract::STATUS_TERMINATED ? 'Abonnement annulé (reprise historique)' : null,
                        'legacy_subscription_id' => $subscription->id,
                        'notes' => "Repris de l'abonnement {$subscription->id} ({$subscription->months} mois).",
                    ]);

                    if ($subscription->invoice_id) {
                        Invoice::whereKey($subscription->invoice_id)
                            ->whereNull('contract_id')
                            ->update(['contract_id' => $contract->id]);
                    }
                });

                $migrated++;
            }
        });

        return ['migrated' => $migrated, 'skipped' => $skipped, 'anomalies' => $anomalies];
    }
}
