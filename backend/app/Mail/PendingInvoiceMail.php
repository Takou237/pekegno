<?php

namespace App\Mail;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Prévient un caissier qu'une vente d'un commercial attend sa validation.
 */
class PendingInvoiceMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoice $invoice,
        public ?string $pendingUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Facture {$this->invoice->number} en attente de validation");
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.pending-invoice',
        );
    }
}
