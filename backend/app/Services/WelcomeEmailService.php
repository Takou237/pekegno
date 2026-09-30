<?php

namespace App\Services;

use App\Mail\UserWelcomeMail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Envoi des paramètres de connexion d'un compte créé via l'interface
 * d'administration (employé, client, prospect converti).
 *
 * Le lien de connexion pointe vers le portail du rôle : site client pour un
 * client, back-office (FRONTEND_URL) pour tout autre rôle. Un SMTP indisponible
 * ne doit jamais faire échouer la création du compte — convention du dépôt
 * depuis T8 : l'administrateur reste responsable de transmettre les identifiants
 * en cas d'échec (l'incident est journalisé).
 */
class WelcomeEmailService
{
    /**
     * Comptes créés sans email réel (apprenant inscrit au guichet, prospect
     * sans adresse) : l'identifiant généré n'est pas une adresse valide,
     * aucun email ne doit partir vers ce domaine interne.
     */
    private const PLACEHOLDER_EMAIL_DOMAIN = 'pekegno.local';

    public function send(User $user, string $plainPassword): void
    {
        if (! $user->email || str_ends_with($user->email, self::PLACEHOLDER_EMAIL_DOMAIN)) {
            return;
        }

        try {
            Mail::to($user->email)->send(new UserWelcomeMail(
                user: $user->loadMissing('role'),
                plainPassword: $plainPassword,
                loginUrl: $this->loginUrlFor($user),
            ));
        } catch (Throwable $e) {
            Log::error("Échec de l'envoi de l'email de bienvenue à l'utilisateur {$user->id} : ".$e->getMessage());
        }
    }

    /**
     * Portail correspondant au rôle : les clients se connectent au site client
     * (/connexion), les autres rôles au back-office interne (/login).
     */
    private function loginUrlFor(User $user): ?string
    {
        if ($user->role?->name === 'client') {
            $baseUrl = rtrim((string) config('app.client_frontend_url'), '/');

            return $baseUrl !== '' ? $baseUrl.'/connexion' : null;
        }

        $baseUrl = rtrim((string) config('app.frontend_url'), '/');

        return $baseUrl !== '' ? $baseUrl.'/login' : null;
    }
}
