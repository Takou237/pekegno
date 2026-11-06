<?php

namespace App\Support;

/**
 * Arrondi monétaire unique de la plateforme.
 *
 * Les montants sont stockés avec leurs décimales (réconciliation comptable)
 * mais tous les agrégats exposés par l'API et l'affichage passent au franc :
 * aucune réponse de synthèse ne doit contenir de centimes.
 */
final class Money
{
    /** Arrondi au franc (0 décimale), en conservant un float. */
    public static function franc(mixed $value): float
    {
        return (float) round((float) $value, 0);
    }

    /** Arrondi générique, utilisé pour les valeurs qui doivent rester précises. */
    public static function round(mixed $value, int $precision = 0): float
    {
        return (float) round((float) $value, $precision);
    }

    /** Somme d'une collection/valeur déjà agrégée, arrondie au franc. */
    public static function sum(mixed $value): float
    {
        return self::franc($value);
    }
}
