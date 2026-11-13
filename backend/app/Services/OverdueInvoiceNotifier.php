<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Setting;
use Illuminate\Support\Carbon;

/**
 * Lot 7 — notifications « créance échue ».
 *
 * Une facture validée, non annulée et non soldée dont l'échéance est dépassée
 * déclenche une alerte interne (commercial vendeur + chef d'agence), une seule
 * fois par facture grâce à la clé de déduplication.
 *
 * Échéance : `invoices.due_date` si elle est renseignée, sinon `invoice_date`
 * plus le délai de paiement configurable par agence (30 jours par défaut).
 */
class OverdueInvoiceNotifier
{
    public const DEFAULT_DUE_DAYS = 30;

    public function __construct(private readonly AgencyNotifier $notifier) {}

    /** Délai de paiement (en jours) configuré pour une agence. */
    public function dueDaysForAgency(?string $agencyId): int
    {
        if (! $agencyId) {
            return self::DEFAULT_DUE_DAYS;
        }

        $value = Setting::where('key', "agency_invoice_due_days:{$agencyId}")->first()?->value;

        return max(0, is_numeric($value) ? (int) $value : self::DEFAULT_DUE_DAYS);
    }

    /** Échéance effective d'une facture, ou null si indéterminable. */
    public function dueDateFor(Invoice $invoice): ?Carbon
    {
        if ($invoice->due_date) {
            return $invoice->due_date->copy()->startOfDay();
        }

        if (! $invoice->invoice_date) {
            return null;
        }

        return $invoice->invoice_date
            ->copy()
            ->startOfDay()
            ->addDays($this->dueDaysForAgency($invoice->agency_id));
    }

    /**
     * Crée les notifications des créances échues.
     *
     * @return array{overdue: int, notified: int}
     */
    public function run(?Carbon $reference = null): array
    {
        $today = ($reference ?? now())->copy()->startOfDay();
        $overdue = 0;
        $notified = 0;

        $invoices = Invoice::query()
            ->where('validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereNull('cancelled_at')
            ->whereColumn('amount_paid', '<', 'total_amount')
            ->with('commercial:id,user_id')
            ->get();

        foreach ($invoices as $invoice) {
            $due = $this->dueDateFor($invoice);

            if (! $due || $due->greaterThanOrEqualTo($today)) {
                continue;
            }

            $overdue++;
            $notified += $this->notifyInvoice($invoice, $due, $today);
        }

        return ['overdue' => $overdue, 'notified' => $notified];
    }

    private function notifyInvoice(Invoice $invoice, Carbon $due, Carbon $today): int
    {
        $daysLate = (int) $due->diffInDays($today);
        $balance = (float) $invoice->balance_due;
        $count = 0;

        foreach ($this->recipients($invoice) as $userId) {
            $notification = $this->notifier->notify(
                userId: $userId,
                type: 'invoice_overdue',
                title: "Créance échue — facture {$invoice->number}",
                body: sprintf(
                    'La facture %s (%s) est échue depuis %d jour(s) : reste %s à encaisser.',
                    $invoice->number,
                    $invoice->client_label ?? 'client',
                    $daysLate,
                    number_format($balance, 0, ',', ' '),
                ),
                entityType: 'invoice',
                entityId: $invoice->id,
                data: [
                    'due_date' => $due->toDateString(),
                    'days_overdue' => $daysLate,
                    'balance_due' => $balance,
                    'agency_id' => $invoice->agency_id,
                ],
                dedupeKey: "invoice:{$invoice->id}:overdue",
            );

            if ($notification->wasRecentlyCreated) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Destinataires internes : commercial vendeur, vendeur/créateur de la
     * facture et chefs de l'agence d'encaissement.
     *
     * @return array<int, string>
     */
    private function recipients(Invoice $invoice): array
    {
        $ids = collect([
            $invoice->commercial?->user_id,
            $invoice->seller_user_id,
            $invoice->created_by,
        ]);

        if ($invoice->agency_id) {
            $ids = $ids->merge($this->notifier->agencyChiefIds($invoice->agency_id));
        }

        return $ids->filter()->unique()->values()->all();
    }
}
