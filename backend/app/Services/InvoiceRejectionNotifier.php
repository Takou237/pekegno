<?php

namespace App\Services;

use App\Mail\CommercialInvoiceRejectionMail;
use App\Mail\InvoiceStatusMail;
use App\Models\Commercial;
use App\Models\Invoice;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Rejet d'une facture (refus par le caissier / la direction).
 *
 * Message de refus + motif notifiés selon l'origine de la facture :
 *  - commande passée par le client (`client_self`) → le client seul ;
 *  - vente enregistrée par un commercial → le commercial + le client.
 *
 * Canaux : notification in-app (`agency_notifications`) + email.
 */
class InvoiceRejectionNotifier
{
    public function __construct(
        private readonly AgencyNotifier $notifier,
    ) {}

    public function notify(Invoice $invoice, string $reason): void
    {
        $reason = trim($reason);
        $invoice->loadMissing(['client', 'commercial', 'commercial.user']);

        foreach ($this->recipients($invoice) as $recipient) {
            $this->notifier->notify(
                userId: $recipient['user_id'],
                type: 'invoice_rejected',
                title: "Facture {$invoice->number} rejetée",
                body: $recipient['body'],
                entityType: 'invoice',
                entityId: $invoice->id,
                data: [
                    'invoice_id' => $invoice->id,
                    'invoice_number' => $invoice->number,
                    'rejection_reason' => $reason,
                    'amount' => (float) $invoice->total_amount,
                ],
                dedupeKey: "invoice:{$invoice->id}:rejected",
            );
        }

        $this->sendClientEmail($invoice);
        $this->sendCommercialEmail($invoice, $reason);
    }

    /**
     * Destinataires de la notification in-app selon l'origine de la facture.
     *
     * @return array<int, array{user_id: string, body: string}>
     */
    private function recipients(Invoice $invoice): array
    {
        $recipients = [];
        $reason = trim((string) $invoice->rejection_reason);

        $client = $invoice->client;
        if ($client) {
            $recipients[] = [
                'user_id' => $client->id,
                'body' => "Votre facture {$invoice->number} a été refusée par l'agence."
                    .($reason !== '' ? " Motif : {$reason}" : ''),
            ];
        }

        // Vente du commercial : le commercial vendeur est également destinataire.
        $commercialUser = $invoice->source === 'client_self'
            ? null
            : $invoice->commercial?->user_id;

        if ($commercialUser && $commercialUser !== $client?->id) {
            $clientName = trim(($invoice->client?->first_name ?? '').' '.($invoice->client?->last_name ?? ''))
                ?: 'un client';
            $recipients[] = [
                'user_id' => $commercialUser,
                'body' => "La facture {$invoice->number} de {$clientName} a été refusée lors de la validation."
                    .($reason !== '' ? " Motif : {$reason}" : ''),
            ];
        }

        return $recipients;
    }

    private function sendClientEmail(Invoice $invoice): void
    {
        $email = $invoice->client?->email;

        if (! $email) {
            return;
        }

        $frontend = rtrim((string) env('FRONTEND_URL', ''), '/');

        // Un SMTP en panne ne doit pas faire échouer le rejet, déjà enregistré
        // en base à ce stade.
        try {
            Mail::to($email)->send(new InvoiceStatusMail(
                invoice: $invoice,
                clientUrl: $frontend !== '' ? "{$frontend}/mon-compte/factures" : null,
            ));
        } catch (\Throwable $e) {
            Log::error("Échec de l'envoi de l'email de rejet de la facture {$invoice->number} au client : ".$e->getMessage());
        }
    }

    private function sendCommercialEmail(Invoice $invoice, string $reason): void
    {
        $commercial = $invoice->commercial;
        $email = $commercial?->email ?: $commercial?->user?->email;

        if (! $commercial instanceof Commercial || ! $email) {
            return;
        }

        $staffUrl = rtrim((string) env('APP_URL', ''), '/');

        try {
            Mail::to($email)->send(new CommercialInvoiceRejectionMail(
                invoice: $invoice,
                reason: $reason,
                staffUrl: $staffUrl !== '' ? "{$staffUrl}/factures/{$invoice->id}" : null,
            ));
        } catch (\Throwable $e) {
            Log::error("Échec de l'envoi de l'email de rejet de la facture {$invoice->number} au commercial : ".$e->getMessage());
        }
    }
}
