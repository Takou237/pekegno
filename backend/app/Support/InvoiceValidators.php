<?php

namespace App\Support;

/**
 * Rôles habilités à valider / rejeter les factures en attente et à examiner
 * les preuves de paiement. Le directeur général rattaché à un pays ne le fait
 * que pour les factures de ce pays (périmètre vérifié par les contrôleurs).
 */
final class InvoiceValidators
{
    public const ROLES = ['super-admin', 'caissier', 'direction-generale'];

    public static function allows(?string $roleName): bool
    {
        return in_array($roleName, self::ROLES, true);
    }
}
