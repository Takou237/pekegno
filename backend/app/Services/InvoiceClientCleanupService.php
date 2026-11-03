<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Prestation;
use App\Models\SessionParticipant;
use App\Models\Subscription;
use App\Models\User;

/**
 * Nettoyage des factures d'inscription / souscription rejetées ou annulées :
 * l'inscription liée est annulée et le client créé pour l'occasion est supprimé
 * (suppression logique) s'il n'a aucune autre activité.
 */
class InvoiceClientCleanupService
{
    /**
     * Annule l'inscription à une formation rattachée à la facture, le cas échéant.
     */
    public function cancelLinkedEnrollment(Invoice $invoice): void
    {
        $enrollmentIds = FormationEnrollment::query()
            ->where('invoice_id', $invoice->id)
            ->pluck('id');

        if ($enrollmentIds->isEmpty()) {
            return;
        }

        FormationEnrollment::whereIn('id', $enrollmentIds)->update(['status' => 'cancelled']);

        SessionParticipant::whereIn('formation_enrollment_id', $enrollmentIds)
            ->whereHas('session', fn ($q) => $q->where(fn ($w) => $w->where('end_at', '>', now())->orWhereNull('end_at')))
            ->update(['status' => 'cancelled']);
    }

    /**
     * Supprime le client créé lors de l'opération si la facture n'a jamais été
     * validée et que le client n'a aucune autre facture / inscription / contrat.
     * Un client préexistant (client_was_created = false) n'est jamais touché.
     */
    public function deleteClientIfCreatedForInvoice(Invoice $invoice): void
    {
        if (! $invoice->client_was_created) {
            return;
        }

        // Une facture validée a fait entrer le client dans le registre : même
        // annulée ensuite, elle ne justifie pas de supprimer le client.
        if ($invoice->validation_status === Invoice::VALIDATION_VALIDATED) {
            return;
        }

        $client = User::find($invoice->client_id);

        if (! $client || $client->role?->name !== 'client') {
            return;
        }

        if ($this->hasOtherActivity($client, $invoice)) {
            return;
        }

        $client->softDeleteClient();
    }

    private function hasOtherActivity(User $client, Invoice $invoice): bool
    {
        if (Invoice::where('client_id', $client->id)->whereKeyNot($invoice->id)->exists()) {
            return true;
        }

        $contractId = $invoice->contract_id;

        if (Contract::where('client_id', $client->id)
            ->when($contractId, fn ($q) => $q->whereKeyNot($contractId))
            ->exists()) {
            return true;
        }

        if (Prestation::where('client_id', $client->id)
            ->when($contractId, fn ($q) => $q->where(fn ($w) => $w->whereNull('contract_id')->orWhere('contract_id', '!=', $contractId)))
            ->exists()) {
            return true;
        }

        $enrollmentIds = FormationEnrollment::where('invoice_id', $invoice->id)->pluck('id');

        if (FormationEnrollment::where('learner_user_id', $client->id)
            ->when($enrollmentIds->isNotEmpty(), fn ($q) => $q->whereNotIn('id', $enrollmentIds))
            ->exists()) {
            return true;
        }

        if (Subscription::where('client_id', $client->id)
            ->where(fn ($q) => $q->whereNull('invoice_id')->orWhere('invoice_id', '!=', $invoice->id))
            ->exists()) {
            return true;
        }

        return Order::where('client_id', $client->id)
            ->where(fn ($q) => $q->whereNull('invoice_id')->orWhere('invoice_id', '!=', $invoice->id))
            ->exists();
    }
}
