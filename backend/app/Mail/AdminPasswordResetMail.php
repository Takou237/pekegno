<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Nouveau mot de passe attribué par un administrateur.
 *
 * Contrairement à ResetPasswordMail (lien de réinitialisation choisi par
 * l'utilisateur), l'administrateur génère un mot de passe provisoire qu'il
 * transmet par email.
 */
class AdminPasswordResetMail extends Mailable
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
            subject: 'Votre mot de passe '.config('app.name').' a été réinitialisé',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.admin-password-reset',
        );
    }
}
