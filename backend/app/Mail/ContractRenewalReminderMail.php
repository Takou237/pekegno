<?php

namespace App\Mail;

use App\Models\Contract;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Agency (D18) : rappel de renouvellement envoyé au client. */
class ContractRenewalReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Contract $contract,
        public int $daysLeft,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Votre contrat {$this->contract->number} arrive à échéance");
    }

    public function content(): Content
    {
        return new Content(view: 'emails.contract-renewal-reminder');
    }
}
