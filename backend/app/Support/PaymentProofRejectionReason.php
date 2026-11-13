<?php

namespace App\Support;

/**
 * B25 — motifs de rejet d'une preuve de paiement (décision client T0.5).
 *
 * Le motif est choisi dans une liste fermée pour que les rejets soient
 * exploitables (statistiques, relances) ; le texte libre reste possible en
 * complément et obligatoire pour « Autre ». La liste est la source unique côté
 * serveur ; le frontend en reprend les codes dans `proofRejectionReasons.ts`.
 */
class PaymentProofRejectionReason
{
    public const EXPIRED_DATE = 'expired_date';

    public const WRONG_AMOUNT = 'wrong_amount';

    public const UNREADABLE = 'unreadable';

    public const WRONG_RECIPIENT = 'wrong_recipient';

    public const OTHER = 'other';

    /** @var array<string, string> */
    public const LABELS = [
        self::EXPIRED_DATE => 'Date échue',
        self::WRONG_AMOUNT => 'Montant erroné',
        self::UNREADABLE => 'Preuve illisible',
        self::WRONG_RECIPIENT => 'Mauvais destinataire',
        self::OTHER => 'Autre',
    ];

    /** @return list<string> */
    public static function codes(): array
    {
        return array_keys(self::LABELS);
    }

    public static function label(?string $code): ?string
    {
        return $code === null ? null : (self::LABELS[$code] ?? null);
    }

    /**
     * Motif lisible d'un rejet : « Date échue — précision ».
     * Retourne null si aucune information n'est disponible.
     */
    public static function describe(?string $code, ?string $notes): ?string
    {
        $label = self::label($code);
        $notes = trim((string) $notes);

        return match (true) {
            $label !== null && $notes !== '' => "{$label} — {$notes}",
            $label !== null => $label,
            $notes !== '' => $notes,
            default => null,
        };
    }
}
