<?php

namespace App\Console\Commands;

use App\Models\Agency;
use App\Models\InvoicePayment;
use App\Models\PaymentProof;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Services\TreasuryAccountProvisioner;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Rattrapage T1.4 / T2.5 / B11 sur les paiements existants. Simulation par
 * défaut ; --apply écrit. Rejouable : un paiement déjà rattaché n'est pas retouché.
 *
 *  1. Crée les caisses standard (C/O/M/B, + W/V en XOF) de chaque agence.
 *  2. Date de réception (B11) : un paiement créé à la validation d'une preuve
 *     prend la date de dépôt de cette preuve (preuve acceptée de la même facture,
 *     revue dans les 10 minutes autour du paiement). L'écriture de recette
 *     correspondante est redatée.
 *  3. Rattache chaque paiement sans caisse à la caisse de son mode de paiement
 *     et crée le mouvement d'entrée manquant, daté de la réception. Les paiements
 *     annulés sont rattachés sans mouvement (l'argent n'est plus en caisse).
 *  4. Liste les anomalies (mode « mobile » ambigu, facture sans agence…).
 *
 * À lancer APRÈS `invoices:reverse-cancelled-payments --apply`.
 */
class BackfillPaymentTreasury extends Command
{
    protected $signature = 'treasury:backfill-payments {--apply : Écrire les corrections (sinon simulation)}';

    protected $description = 'Rattache les paiements existants à leur caisse (C/O/M/B) et corrige leur date de réception';

    private const PROOF_MATCH_MINUTES = 10;

    public function handle(TreasuryAccountProvisioner $provisioner): int
    {
        // Rattrapage de l'historique : les journées déjà clôturées gardent leurs dates.
        \App\Models\TreasuryTransaction::$enforceCashClosing = false;

        $apply = (bool) $this->option('apply');

        $missingAccounts = $this->provisionAccounts($provisioner, $apply);

        $payments = InvoicePayment::with('invoice')
            ->whereNull('treasury_account_id')
            ->orderBy('paid_at')
            ->get();

        $rows = [];
        $anomalies = [];
        $redated = 0;
        $attached = 0;
        $movements = 0;
        $total = 0.0;

        foreach ($payments as $payment) {
            $invoice = $payment->invoice;
            if (! $invoice) {
                $anomalies[] = [$payment->receipt_number ?? $payment->id, '-', 'Paiement sans facture'];

                continue;
            }

            $receivedAt = $this->receivedAtFromProof($payment) ?? $payment->received_at ?? $payment->paid_at;
            $redate = $receivedAt && $payment->received_at && ! $receivedAt->equalTo($payment->received_at);

            [$account, $problem] = $this->accountFor($payment, $provisioner, $apply);
            if ($problem !== null) {
                $anomalies[] = [$payment->receipt_number ?? $payment->id, $invoice->number, $problem];
            }

            $withMovement = $account !== null && $payment->cancelled_at === null;

            $rows[] = [
                $invoice->number,
                $payment->receipt_number,
                $payment->payment_method,
                number_format((float) $payment->amount, 0, ',', ' '),
                $account?->code ?? ($problem !== null ? '?' : '(à créer)'),
                $payment->received_at?->format('d/m H:i'),
                $redate ? $receivedAt->format('d/m H:i') : '=',
                $payment->cancelled_at ? 'annulé' : '',
            ];

            if ($redate) {
                $redated++;
            }
            if ($account !== null || (! $apply && $problem === null)) {
                $attached++;
                $total += (float) $payment->amount;
                if ($payment->cancelled_at === null) {
                    $movements++;
                }
            }

            if (! $apply) {
                continue;
            }

            DB::transaction(function () use ($payment, $invoice, $account, $receivedAt, $redate, $withMovement) {
                if ($redate) {
                    // Écriture de recette du paiement : même facture, même montant,
                    // datée de l'ancienne date de règlement.
                    DB::table('accounting_transactions')
                        ->where('invoice_id', $invoice->id)
                        ->where('type', 'income')
                        ->where('amount', $payment->amount)
                        ->where('transacted_at', $payment->received_at)
                        ->limit(1)
                        ->update(['transacted_at' => $receivedAt]);

                    $payment->received_at = $receivedAt;
                }

                if ($account !== null) {
                    $payment->treasury_account_id = $account->id;

                    $exists = TreasuryTransaction::where('source_type', 'invoice_payment')
                        ->where('source_id', $payment->id)
                        ->exists();

                    if ($withMovement && ! $exists) {
                        TreasuryTransaction::create([
                            'treasury_account_id' => $account->id,
                            'direction' => TreasuryTransaction::DIRECTION_IN,
                            'amount' => $payment->amount,
                            'source_type' => 'invoice_payment',
                            'source_id' => $payment->id,
                            'category' => 'vente',
                            'label' => "Paiement facture {$invoice->number} (rattrapage)",
                            'reference' => $invoice->number,
                            'transacted_at' => $payment->received_at ?? $payment->paid_at,
                            'created_by' => $payment->received_by,
                        ]);
                    }
                }

                $payment->save();
            });
        }

        $this->table(['Facture', 'Reçu', 'Mode', 'Montant', 'Caisse', 'Réception actuelle', 'Nouvelle réception', ''], $rows);

        if ($anomalies !== []) {
            $this->warn(count($anomalies).' anomalie(s) à traiter à la main :');
            $this->table(['Paiement', 'Facture', 'Anomalie'], $anomalies);
        }

        $this->info(sprintf(
            '%d caisse(s) standard %s ; %d paiement(s) rattaché(s) (%s), %d mouvement(s) de caisse, %d date(s) de réception corrigée(s)%s.',
            $missingAccounts,
            $apply ? 'créée(s)' : 'à créer',
            $attached,
            number_format($total, 0, ',', ' '),
            $movements,
            $redated,
            $apply ? '' : ' (SIMULATION — relancer avec --apply)',
        ));

        return self::SUCCESS;
    }

    private function provisionAccounts(TreasuryAccountProvisioner $provisioner, bool $apply): int
    {
        $missing = 0;

        foreach (Agency::all() as $agency) {
            foreach ($provisioner->codesForAgency($agency) as $code) {
                $exists = TreasuryAccount::withTrashed()->where('agency_id', $agency->id)->where('code', $code)->exists();
                if (! $exists) {
                    $missing++;
                    if ($apply) {
                        $provisioner->ensureAccount($agency, $code);
                    }
                }
            }
        }

        return $missing;
    }

    /**
     * @return array{0: ?TreasuryAccount, 1: ?string} caisse, anomalie
     */
    private function accountFor(InvoicePayment $payment, TreasuryAccountProvisioner $provisioner, bool $apply): array
    {
        $invoice = $payment->invoice;

        if ($invoice->agency_id === null) {
            return [null, 'Facture sans agence : caisse à choisir (Administration, lot 3)'];
        }

        $code = TreasuryAccountProvisioner::codeForMethod($payment->payment_method);
        $accounts = TreasuryAccount::where('agency_id', $invoice->agency_id);

        if ($code === null) {
            $mobiles = (clone $accounts)->where('type', TreasuryAccount::TYPE_MOBILE_MONEY)->get();
            if ($mobiles->count() === 1) {
                return [$mobiles->first(), null];
            }

            return [null, "Mode « {$payment->payment_method} » ambigu : préciser O, M, W ou V"];
        }

        $account = (clone $accounts)->where('code', $code)->first();
        if ($account === null && $apply) {
            $account = $provisioner->ensureAccount($invoice->agency, $code);
        }

        return [$account, null];
    }

    /** Date de dépôt de la preuve acceptée dont la validation a créé ce paiement. */
    private function receivedAtFromProof(InvoicePayment $payment): ?Carbon
    {
        $reference = $payment->validated_at ?? $payment->paid_at;
        if (! $reference) {
            return null;
        }

        $proof = PaymentProof::where('invoice_id', $payment->invoice_id)
            ->where('status', PaymentProof::STATUS_ACCEPTED)
            ->whereBetween('reviewed_at', [
                $reference->copy()->subMinutes(self::PROOF_MATCH_MINUTES),
                $reference->copy()->addMinutes(self::PROOF_MATCH_MINUTES),
            ])
            ->orderBy('reviewed_at')
            ->first();

        return $proof?->created_at && $proof->created_at->lessThan($reference) ? $proof->created_at : null;
    }
}
