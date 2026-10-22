<?php

namespace App\Services;

use App\Mail\PendingInvoiceMail;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Envoie un email aux caissiers quand un commercial enregistre une vente : la
 * facture naît en attente et ne devient définitive qu'après leur validation.
 *
 * Seuls les caissiers affectés à l'agence de la facture sont avertis. Un SMTP
 * indisponible ne bloque pas la vente.
 */
class PendingInvoiceNotifier
{
    public function notify(Invoice $invoice): void
    {
        $recipients = $this->recipientsFor($invoice);

        if ($recipients->isEmpty()) {
            return;
        }

        $invoice->loadMissing(['items', 'client', 'commercial', 'agency.geoCountry', 'seller']);

        $frontend = rtrim((string) config('app.frontend_url'), '/');
        $pendingUrl = $frontend !== '' ? "{$frontend}/invoices/pending" : null;

        foreach ($recipients as $email) {
            try {
                Mail::to($email)->send(new PendingInvoiceMail($invoice, $pendingUrl));
            } catch (Throwable $e) {
                Log::error("Échec de l'envoi de l'email « facture en attente » {$invoice->number} à {$email} : ".$e->getMessage());
            }
        }
    }

    /**
     * @return Collection<int, string>
     */
    private function recipientsFor(Invoice $invoice): Collection
    {
        if (! $invoice->agency_id) {
            return collect();
        }

        return $this->cashierEmails([$invoice->agency_id]);
    }

    /**
     * @param  array<int, string>|null  $agencyIds  null = tous les caissiers
     * @return Collection<int, string>
     */
    private function cashierEmails(?array $agencyIds): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->whereNotNull('email')
            ->whereHas('role', fn (Builder $q) => $q->where('name', 'caissier'))
            ->when($agencyIds !== null, fn (Builder $q) => $q->whereIn('id', DB::table('user_assignments')
                ->whereIn('agency_id', $agencyIds)
                ->select('user_id')))
            ->pluck('email')
            ->unique()
            ->values();
    }
}
