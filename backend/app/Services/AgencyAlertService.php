<?php

namespace App\Services;

use App\Mail\ContractRenewalReminderMail;
use App\Models\Activity;
use App\Models\Contract;
use App\Models\PrestationAction;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Automatisations quotidiennes du département Agency :
 * - renouvellements (D8 : J-30/15/7/1 configurables ; D14 : chef d'agence + client ;
 *   D18 : e-mail + notification portail) ;
 * - actions en retard (assigné + responsables de la prestation).
 */
class AgencyAlertService
{
    public function __construct(
        private readonly ContractService $contracts,
        private readonly AgencyNotifier $notifier,
    ) {}

    /** @return array{due_soon: int, expired: int, alerts: int, overdue_actions: int} */
    public function run(): array
    {
        $dueSoon = $this->contracts->markDueSoon();
        $alerts = $this->sendRenewalAlerts();
        $expired = $this->contracts->markExpired();
        $overdue = $this->notifyOverdueActions();

        return ['due_soon' => $dueSoon, 'expired' => $expired, 'alerts' => $alerts, 'overdue_actions' => $overdue];
    }

    /**
     * Pour chaque contrat actif / à renouveler, émet l'alerte du plus petit seuil
     * franchi (ex. à J-10 : alerte « J-15 »). Chaque seuil n'est émis qu'une fois
     * par contrat et par destinataire (dedupe_key), même si la commande est rejouée.
     */
    public function sendRenewalAlerts(): int
    {
        $sent = 0;

        $contracts = Contract::query()
            ->whereIn('status', [Contract::STATUS_ACTIVE, Contract::STATUS_DUE_SOON])
            ->whereDate('end_date', '>=', today())
            ->with('client:id,first_name,last_name,email', 'pack:id,name', 'prestation:id,name,reference')
            ->get();

        foreach ($contracts as $contract) {
            $days = (int) today()->diffInDays($contract->end_date, false);
            $thresholds = $this->contracts->getRenewAlertDays($contract->department_id);
            sort($thresholds);

            $threshold = collect($thresholds)->first(fn (int $t) => $days <= $t);
            if ($threshold === null) {
                continue;
            }

            $sent += $this->alertContract($contract, $threshold, $days);
        }

        return $sent;
    }

    private function alertContract(Contract $contract, int $threshold, int $days): int
    {
        $dedupe = "contract:{$contract->id}:renewal:J{$threshold}";
        $subject = $contract->pack?->name ?? $contract->prestation?->name ?? 'votre contrat';
        $endDate = $contract->end_date->format('d/m/Y');
        $count = 0;

        // Chef(s) d'agence : notification + tâche de relance (D14).
        foreach ($this->notifier->agencyChiefIds($contract->agency_id) as $chiefId) {
            $notification = $this->notifier->notify(
                userId: $chiefId,
                type: 'contract_renewal',
                title: "Renouvellement J-{$threshold} — contrat {$contract->number}",
                body: "Le contrat {$contract->number} ({$subject}) arrive à échéance le {$endDate} (dans {$days} jour(s)).",
                entityType: 'contract',
                entityId: $contract->id,
                data: ['threshold' => $threshold, 'days_left' => $days],
                dedupeKey: $dedupe,
            );

            if ($notification->wasRecentlyCreated) {
                Activity::create([
                    'subject_type' => Contract::class,
                    'subject_id' => $contract->id,
                    'assigned_to' => $chiefId,
                    'type' => 'followup',
                    'title' => "Relancer le renouvellement du contrat {$contract->number}",
                    'notes' => "Échéance le {$endDate} — alerte J-{$threshold}.",
                    'due_at' => $contract->end_date->copy()->startOfDay(),
                ]);
                $count++;
            }
        }

        // Client : notification portail + e-mail (D18).
        $client = $contract->client;
        if ($client) {
            $notification = $this->notifier->notify(
                userId: $client->id,
                type: 'contract_renewal',
                title: "Votre contrat {$contract->number} arrive à échéance",
                body: "Votre contrat « {$subject} » se termine le {$endDate}. Contactez-nous pour le renouveler.",
                entityType: 'contract',
                entityId: $contract->id,
                data: ['threshold' => $threshold, 'days_left' => $days],
                dedupeKey: $dedupe,
            );

            if ($notification->wasRecentlyCreated) {
                $this->mailClient($client, $contract, $days);
                $count++;
            }
        }

        return $count;
    }

    private function mailClient(User $client, Contract $contract, int $days): void
    {
        if (! $client->email) {
            return;
        }

        try {
            Mail::to($client->email)->send(new ContractRenewalReminderMail($contract, $days));
        } catch (\Throwable $e) {
            Log::error("Rappel de renouvellement non envoyé pour le contrat {$contract->number} : ".$e->getMessage());
        }
    }

    /** Actions en retard : une notification par action (assigné + responsables). */
    public function notifyOverdueActions(): int
    {
        $count = 0;

        $actions = PrestationAction::query()
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', today())
            ->whereNotIn('status', PrestationAction::FINISHED_STATUSES)
            ->whereNull('overdue_notified_at')
            ->with('prestation')
            ->get();

        foreach ($actions as $action) {
            $prestation = $action->prestation;
            if (! $prestation) {
                continue;
            }

            $recipients = collect($this->notifier->prestationOwnerIds($prestation))
                ->push($action->assigned_to)
                ->filter()
                ->unique();

            foreach ($recipients as $userId) {
                $this->notifier->notify(
                    userId: $userId,
                    type: 'action_overdue',
                    title: "Action en retard — {$prestation->reference}",
                    body: "L'action « {$action->title} » devait être terminée le {$action->due_date->format('d/m/Y')}.",
                    entityType: 'prestation',
                    entityId: $prestation->id,
                    data: ['action_id' => $action->id],
                    dedupeKey: "action:{$action->id}:overdue",
                );
            }

            $action->update(['overdue_notified_at' => now()]);
            $count++;
        }

        return $count;
    }
}
