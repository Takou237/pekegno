<?php

namespace App\Mail;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CommercialInvoiceRejectionMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoice $invoice,
        public string $reason,
        public ?string $staffUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Facture {$this->invoice->number} rejetée — motif du refus",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.commercial-invoice-rejection',
        );
    }
}
