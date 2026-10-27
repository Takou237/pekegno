<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Coupe temporairement tout email destiné à un client (compte de rôle
 * « client ») : bienvenue, factures, rappels de contrat, réinitialisation de
 * mot de passe, code 2FA… Le message est annulé avant l'envoi (MessageSending
 * renvoie false) ; les autres destinataires (staff) ne sont pas concernés.
 *
 * Réactivation : CLIENT_EMAILS_ENABLED=true dans le .env.
 */
class BlockClientEmails
{
    public function handle(MessageSending $event): ?bool
    {
        if (config('mail.client_emails_enabled')) {
            return null;
        }

        $emails = collect([
            ...$event->message->getTo(),
            ...$event->message->getCc(),
            ...$event->message->getBcc(),
        ])->map(fn ($address) => strtolower($address->getAddress()))->unique()->values();

        if ($emails->isEmpty()) {
            return null;
        }

        $isClient = User::query()
            ->whereIn(DB::raw('LOWER(email)'), $emails->all())
            ->whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->exists();

        if (! $isClient) {
            return null;
        }

        Log::info('Email client non envoyé (CLIENT_EMAILS_ENABLED=false) : '.$event->message->getSubject().' → '.$emails->implode(', '));

        return false;
    }
}
