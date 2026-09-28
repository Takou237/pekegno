<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Paramètres de connexion transmis au nouvel utilisateur.
 *
 * L'administrateur ne saisit pas de mot de passe dans le formulaire de création :
 * le compte est créé avec le mot de passe par défaut, transmis ici en clair.
 */
class UserWelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $plainPassword,
        public ?string $loginUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Vos accès à '.config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.user-welcome',
        );
    }
}
