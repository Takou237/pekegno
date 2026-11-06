<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Services\InvoiceCancellationService;
use Illuminate\Console\Command;

/**
 * Rattrapage (B9) : contre-passe les paiements des factures annulées AVANT que
 * l'annulation ne le fasse automatiquement. Simulation par défaut ; --apply écrit.
 */
class ReverseCancelledInvoicePayments extends Command
{
    protected $signature = 'invoices:reverse-cancelled-payments {--apply : Écrire les contre-passations (sinon simulation)}';

    protected $description = 'Annule paiements, recettes comptables et commissions des factures déjà annulées';

    public function handle(InvoiceCancellationService $service): int
    {
        $invoices = Invoice::whereNotNull('cancelled_at')
            ->whereIn('id', InvoicePayment::whereNull('cancelled_at')->select('invoice_id'))
            ->orderBy('number')
            ->get();

        $rows = [];
        $total = 0.0;

        foreach ($invoices as $invoice) {
            $amount = (float) InvoicePayment::where('invoice_id', $invoice->id)->whereNull('cancelled_at')->sum('amount');
            $total += $amount;

            $result = $this->option('apply') ? $service->reverseFinancials($invoice) : null;

            $rows[] = [$invoice->number, $invoice->cancelled_at?->toDateTimeString(), number_format($amount, 0, ',', ' '),
                $result ? $result['commissions'] : '-', $result ? $result['paid_commissions'] : '-'];
        }

        $this->table(['Facture', 'Annulée le', 'Paiements', 'Commissions annulées', 'Commissions déjà versées'], $rows);
        $this->info(sprintf('%d facture(s), %s contre-passés%s.', count($rows), number_format($total, 0, ',', ' '),
            $this->option('apply') ? '' : ' (SIMULATION — relancer avec --apply)'));

        return self::SUCCESS;
    }
}
