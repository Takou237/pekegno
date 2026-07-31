<?php

namespace App\Support;

class EmployeeRoles
{
    public const CLIENT = 'client';

    public const SUPER_ADMIN = 'super-admin';

    public const DIRECTION_GENERALE = 'direction-generale';

    /**
     * Rôles qu'un responsable peut créer via le formulaire employé.
     *
     * Les rôles de chef (agence/département) et le rôle client sont gérés
     * par leurs flux dédiés respectifs (pages agence/département et
     * auto-inscription).
     */
    public static function assignableRoleNames(?string $currentRoleName): array
    {
        return match ($currentRoleName) {
            self::SUPER_ADMIN => [
                self::SUPER_ADMIN,
                self::DIRECTION_GENERALE,
                'commercial',
                'caissier',
                'comptable',
                'formateur',
            ],
            self::DIRECTION_GENERALE => [
                self::DIRECTION_GENERALE,
                'commercial',
                'caissier',
                'comptable',
                'formateur',
            ],
            'responsable-agence' => [
                'commercial',
                'caissier',
                'comptable',
                'formateur',
            ],
            default => [],
        };
    }

    public static function isClient(?string $roleName): bool
    {
        return $roleName === self::CLIENT;
    }
}
