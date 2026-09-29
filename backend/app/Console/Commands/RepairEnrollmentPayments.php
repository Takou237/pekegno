<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Models\Role;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Factures d'inscription créées avant le correctif du 29/09/2026 : le montant
 * versé était écrit dans amount_paid sans ligne de paiement, donc absent du
 * bilan (« Total encaissé »), de la trésorerie et de la comptabilité.
 * La commande rejoue ces encaissements via PaymentService, à leur date d'origine.
 */
class RepairEnrollmentPayments extends Command
{
    protected $signature = 'invoices:repair-enrollment-payments {--apply : Enregistrer réellement (sinon simulation)}';

    protected $description = 'Crée les paiements manquants des factures d\'inscription (montant payé sans encaissement)';

    public function handle(PaymentService $payments): int
    {
        $rows = DB::table('invoices')
            ->join('formation_enrollments', 'formation_enrollments.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->select('invoices.id')
            ->selectRaw('invoices.amount_paid - coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = invoices.id), 0) as missing')
            ->distinct()
            ->get()
            ->filter(fn ($r) => (float) $r->missing > 0.005);

        if ($rows->isEmpty()) {
            $this->info('Aucune facture à réparer.');

            return self::SUCCESS;
        }

        $fallbackUserId = User::where('role_id', Role::where('name', 'super-admin')->value('id'))->value('id');

        foreach ($rows as $row) {
            $invoice = Invoice::findOrFail($row->id);
            $missing = round((float) $row->missing, 2);
            $this->line(sprintf('%s : %s manquant (%s)', $invoice->number, number_format($missing, 0, ',', ' '), $this->option('apply') ? 'réparé' : 'simulation'));

            if (! $this->option('apply')) {
                continue;
            }

            DB::transaction(function () use ($invoice, $missing, $payments, $fallbackUserId) {
                // On retire le montant « fantôme » puis on l'encaisse réellement.
                $invoice->amount_paid = round((float) $invoice->amount_paid - $missing, 2);
                $invoice->refreshStatus();
                $invoice->save();

                $payments->applyPayment(
                    $invoice,
                    $missing,
                    $invoice->payment_type ?? 'cash',
                    $missing < (float) $invoice->total_amount,
                    $invoice->seller_user_id ?? $fallbackUserId,
                    null,
                    $invoice->created_at?->toDateTimeString(),
                );
            });
        }

        if (! $this->option('apply')) {
            $this->warn('Simulation : relancer avec --apply pour enregistrer.');
        }

        return self::SUCCESS;
    }
}
