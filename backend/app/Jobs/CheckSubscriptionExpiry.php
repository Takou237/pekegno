<?php

namespace App\Jobs;

use App\Models\Subscription;
use App\Models\SubscriptionNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Moteur de rappels d'expiration (§19 spec).
 *
 * À chaque exécution :
 * - identifie les abonnements éligibles (non annulés/renouvelés/expirés) dont
 *   la fin est dans la fenêtre configurée ;
 * - pour chaque rappel configuré (14/7/2/1/0 jours), crée la notification si
 *   elle n'existe pas déjà (idempotence par (subscription, type)) et la marque envoyée ;
 * - fait passer en « expired » les abonnements dont la date de fin est passée.
 */
class CheckSubscriptionExpiry implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $schedule = config('subscriptions.notifications.schedule', []);
        $maxDays = max(array_values($schedule) ?: [0]);

        $subscriptions = Subscription::query()
            ->whereNotIn('status', ['cancelled', 'renewed', 'expired'])
            ->whereDate('end_date', '<=', today()->addDays($maxDays)->toDateString())
            ->get();

        foreach ($subscriptions as $subscription) {
            $days = (int) today()->diffInDays($subscription->end_date, false);

            foreach ($schedule as $type => $day) {
                if ($days === (int) $day) {
                    $this->deliver($subscription, $type, $days);
                }
            }

            if ($days < 0) {
                $subscription->refreshStatusIfExpired();
            }
        }
    }

    private function deliver(Subscription $subscription, string $type, int $days): void
    {
        $notification = SubscriptionNotification::firstOrCreate(
            ['subscription_id' => $subscription->id, 'notification_type' => $type],
            [
                'scheduled_for' => $subscription->end_date->copy()->subDays($days)->toDateString(),
                'channel' => 'in-app',
                'status' => 'pending',
                'attempt_count' => 0,
            ],
        );

        if ($notification->status === 'sent') {
            return;
        }

        try {
            $notification->forceFill([
                'status' => 'sent',
                'sent_at' => now(),
                'attempt_count' => $notification->attempt_count + 1,
                'error_message' => null,
            ])->save();
        } catch (\Throwable $e) {
            $notification->forceFill([
                'status' => 'failed',
                'attempt_count' => $notification->attempt_count + 1,
                'error_message' => $e->getMessage(),
            ])->save();

            Log::error("Échec d'envoi du rappel {$type} pour l'abonnement {$subscription->id} : ".$e->getMessage());
        }
    }
}