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

    /**
     * Vendeurs dont les souscriptions (packages) et inscriptions (formations)
     * partent en validation avec preuve de paiement : l'avance n'est encaissée
     * qu'à l'acceptation de la preuve par un validateur.
     */
    public const SELLERS_PENDING_VALIDATION = ['commercial', 'responsable-agence', 'responsable-departement'];

    public static function allows(?string $roleName): bool
    {
        return in_array($roleName, self::ROLES, true);
    }

    public static function sellerNeedsValidation(?string $roleName): bool
    {
        return in_array($roleName, self::SELLERS_PENDING_VALIDATION, true);
    }
}
