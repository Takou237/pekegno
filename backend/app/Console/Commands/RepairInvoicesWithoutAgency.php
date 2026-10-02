<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Services\SaleAgencyResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Factures enregistrées sans agence avant le correctif du 01/10/2026 (inscription
 * à une formation globale, vente saisie par un admin sans agence…) : invisibles
 * dans le bilan du jour, leurs encaissements hors caisse et leurs écritures
 * comptables sans agence. La commande les rattache à l'agence du vendeur (même
 * règle que SaleAgencyResolver) et range les versements dans la caisse
 * (compte « cash ») de cette agence, à leur date d'origine.
 */
class RepairInvoicesWithoutAgency extends Command
{
    protected $signature = 'invoices:repair-missing-agency {--apply : Enregistrer réellement (sinon simulation)}';

    protected $description = 'Rattache à une agence les factures sans agence (bilan, caisse, comptabilité)';

    public function handle(SaleAgencyResolver $resolver): int
    {
        $invoices = Invoice::whereNull('agency_id')->orderBy('created_at')->get();

        if ($invoices->isEmpty()) {
            $this->info('Aucune facture sans agence.');

            return self::SUCCESS;
        }

        $apply = (bool) $this->option('apply');

        foreach ($invoices as $invoice) {
            $agencyId = $this->agencyFor($invoice, $resolver);

            if (! $agencyId) {
                $this->warn("{$invoice->number} : agence introuvable (ni formation, ni vendeur rattachés à une agence) — à corriger à la main.");

                continue;
            }

            $agencyName = DB::table('agencies')->where('id', $agencyId)->value('name');
            $account = TreasuryAccount::where('agency_id', $agencyId)->where('type', 'cash')->where('is_active', true)->first();
            $payments = $invoice->payments()->whereNull('treasury_account_id')->get();

            $this->line(sprintf(
                '%s → %s ; %d versement(s) %s (%s)',
                $invoice->number,
                $agencyName,
                $payments->count(),
                $account ? "rangé(s) dans « {$account->name} »" : 'sans caisse active dans cette agence',
                $apply ? 'réparé' : 'simulation',
            ));

            if (! $apply) {
                continue;
            }

            DB::transaction(function () use ($invoice, $agencyId, $account, $payments) {
                $invoice->update(['agency_id' => $agencyId]);

                DB::table('accounting_transactions')
                    ->where('invoice_id', $invoice->id)
                    ->whereNull('agency_id')
                    ->update(['agency_id' => $agencyId]);

                if (! $account) {
                    return;
                }

                foreach ($payments as $payment) {
                    $payment->update(['treasury_account_id' => $account->id]);

                    $alreadyMoved = TreasuryTransaction::where('source_type', 'invoice_payment')
                        ->where('source_id', $payment->id)
                        ->exists();
                    if ($alreadyMoved || (float) $payment->amount <= 0) {
                        continue;
                    }

                    // Même mouvement que PaymentService, mais à la date du versement.
                    TreasuryTransaction::create([
                        'treasury_account_id' => $account->id,
                        'direction' => 'in',
                        'amount' => $payment->amount,
                        'source_type' => 'invoice_payment',
                        'source_id' => $payment->id,
                        'category' => 'vente',
                        'label' => "Paiement facture {$invoice->number}",
                        'reference' => $invoice->number,
                        'transacted_at' => $payment->paid_at ?? $payment->created_at,
                        'created_by' => $payment->received_by,
                    ]);
                }
            });
        }

        if (! $apply) {
            $this->info('Simulation terminée : relancer avec --apply pour enregistrer.');
        }

        return self::SUCCESS;
    }

    private function agencyFor(Invoice $invoice, SaleAgencyResolver $resolver): ?string
    {
        $courseAgencyId = DB::table('formation_enrollments')
            ->join('courses', 'courses.id', '=', 'formation_enrollments.course_id')
            ->where('formation_enrollments.invoice_id', $invoice->id)
            ->whereNotNull('courses.agency_id')
            ->value('courses.agency_id');

        // Le « connecté » d'origine est inconnu : le vendeur en tient lieu.
        $seller = $invoice->seller_user_id ? User::find($invoice->seller_user_id) : null;

        if (! $seller) {
            return $courseAgencyId
                ?? ($invoice->commercial_id ? DB::table('commercials')->where('id', $invoice->commercial_id)->value('agency_id') : null);
        }

        return $resolver->resolve($courseAgencyId, $seller, $invoice->commercial_id);
    }
}
