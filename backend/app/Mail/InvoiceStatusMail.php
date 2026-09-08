<?php

namespace App\Mail;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvoiceStatusMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoice $invoice,
        public ?string $clientUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        $subject = $this->invoice->validation_status === Invoice::VALIDATION_VALIDATED
            ? "Votre facture {$this->invoice->number} a été validée"
            : "Votre facture {$this->invoice->number} a été rejetée";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.invoice-status',
        );
    }
}