<?php

namespace App\Support;

class EmployeeRoles
{
    public const SUPER_ADMIN = 'super-admin';

    public const DIRECTION_GENERALE = 'direction-generale';

    public const CLIENT = 'client';

    /**
     * Rôles de chef : assignés depuis les pages agence / département
     * (flux dédiés), jamais depuis le formulaire utilisateur.
     */
    private const CHIEF_ROLES = ['responsable-agence', 'responsable-departement'];

    private const CREATOR_ROLES = [self::SUPER_ADMIN, self::DIRECTION_GENERALE, 'responsable-agence'];

    /**
     * Rôles qu'un responsable peut créer via le formulaire employé.
     *
     * Les rôles de chef (agence/département) sont gérés par leurs flux
     * dédiés respectifs (pages agence/département).
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

    /**
     * Un rôle personnalisé (créé depuis « Rôles & Permissions ») peut être
     * attribué depuis le formulaire utilisateur par tout créateur de compte,
     * sans escalade (un responsable-agence ne s'attribue pas super-admin).
     * Le rôle `client` et les rôles de chef restent exclus (flux dédiés).
     */
    public static function isAssignable(string $roleName, ?string $currentRoleName): bool
    {
        if ($roleName === self::CLIENT) {
            return false;
        }

        if (in_array($roleName, self::CHIEF_ROLES, true)) {
            return false;
        }

        if (in_array($roleName, self::assignableRoleNames($currentRoleName), true)) {
            return true;
        }

        if (! in_array($currentRoleName, self::CREATOR_ROLES, true)) {
            return false;
        }

        if (in_array($roleName, [self::SUPER_ADMIN, self::DIRECTION_GENERALE], true)) {
            return false;
        }

        return true;
    }
}
