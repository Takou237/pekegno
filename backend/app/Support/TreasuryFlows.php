<?php

namespace App\Support;

/**
 * Détail d'une journée de caisse, tel que le cahier §2 le demande :
 *
 * - Solde initial : solde final de la veille ;
 * - Entrées : argent reçu dans la caisse (paiements validés, recettes saisies),
 *   les annulations de paiement en sont déduites ;
 * - Sorties : dépenses payées depuis la caisse (hors transferts, hors
 *   annulations de paiement) ;
 * - Transferts reçus / envoyés : d'une caisse à l'autre (versement en banque,
 *   décaissement administratif, retrait) ; ni vente ni dépense ;
 * - Solde théorique = initial + entrées − sorties + transferts reçus − transferts envoyés.
 *
 * Même règle pour le Bilan du jour (BilanService) et la clôture de caisse
 * (CashClosingService).
 */
final class TreasuryFlows
{
    public const SOURCE_TRANSFER = 'transfer';

    public const SOURCE_PAYMENT_CANCEL = 'invoice_payment_cancel';

    /**
     * Agrégats SQL sur `treasury_transactions` jusqu'à la fin du jour ; chaque
     * `?` attend le début du jour (UTC).
     *
     * @return array{0: string, 1: int} [SQL, nombre de bindings « début du jour »]
     */
    public static function selectSql(): array
    {
        $source = "coalesce(source_type, '')";
        $transfer = "'".self::SOURCE_TRANSFER."'";
        $cancel = "'".self::SOURCE_PAYMENT_CANCEL."'";

        return [
            "sum(case when transacted_at < ? then (case when direction = 'in' then amount else -amount end) else 0 end) as before_day,
            sum(case
                when transacted_at >= ? and direction = 'in' and {$source} <> {$transfer} then amount
                when transacted_at >= ? and direction = 'out' and {$source} = {$cancel} then -amount
                else 0 end) as day_in,
            sum(case when transacted_at >= ? and direction = 'out' and {$source} not in ({$transfer}, {$cancel}) then amount else 0 end) as day_out,
            sum(case when transacted_at >= ? and direction = 'in' and {$source} = {$transfer} then amount else 0 end) as day_transfer_in,
            sum(case when transacted_at >= ? and direction = 'out' and {$source} = {$transfer} then amount else 0 end) as day_transfer_out",
            6,
        ];
    }

    /**
     * Ligne d'agrégats → détail du jour (multiplié par $rate pour une vue
     * convertie dans la monnaie du groupe).
     *
     * @return array{opening: float, in: float, out: float, transfer_in: float, transfer_out: float, closing: float}
     */
    public static function fromRow(?object $row, float $accountOpening, float $rate = 1.0): array
    {
        $opening = round(($accountOpening + (float) ($row->before_day ?? 0)) * $rate, 2);
        $in = round((float) ($row->day_in ?? 0) * $rate, 2);
        $out = round((float) ($row->day_out ?? 0) * $rate, 2);
        $transferIn = round((float) ($row->day_transfer_in ?? 0) * $rate, 2);
        $transferOut = round((float) ($row->day_transfer_out ?? 0) * $rate, 2);

        return [
            'opening' => $opening,
            'in' => $in,
            'out' => $out,
            'transfer_in' => $transferIn,
            'transfer_out' => $transferOut,
            'closing' => round($opening + $in - $out + $transferIn - $transferOut, 2),
        ];
    }
}
