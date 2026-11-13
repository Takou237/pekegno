<?php

namespace App\Services;

use App\Models\AgencyNotification;
use App\Models\Commercial;
use App\Models\Prestation;
use Illuminate\Support\Facades\DB;

/**
 * Notifications in-app du département Agency (staff et portail client).
 * Avec une `dedupeKey`, une même alerte n'est créée qu'une fois par destinataire.
 */
class AgencyNotifier
{
    public function notify(
        string $userId,
        string $type,
        string $title,
        ?string $body = null,
        ?string $entityType = null,
        ?string $entityId = null,
        array $data = [],
        ?string $dedupeKey = null,
    ): AgencyNotification {
        $attributes = [
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'data' => $data ?: null,
        ];

        if ($dedupeKey === null) {
            return AgencyNotification::create(['user_id' => $userId] + $attributes);
        }

        return AgencyNotification::firstOrCreate(
            ['user_id' => $userId, 'dedupe_key' => $dedupeKey],
            $attributes,
        );
    }

    /**
     * Chefs d'une agence : titulaire de l'affectation « chef d'agence »
     * (user_assignments.is_primary) et comptes `responsable-agence` rattachés.
     *
     * @return array<int, string>
     */
    public function agencyChiefIds(string $agencyId): array
    {
        $primary = DB::table('user_assignments')
            ->where('agency_id', $agencyId)
            ->where('is_primary', true)
            ->pluck('user_id');

        $managers = DB::table('user_assignments')
            ->join('users', 'users.id', '=', 'user_assignments.user_id')
            ->join('roles', 'roles.id', '=', 'users.role_id')
            ->where('user_assignments.agency_id', $agencyId)
            ->where('roles.name', 'responsable-agence')
            ->pluck('users.id');

        return $primary->merge($managers)->filter()->unique()->values()->all();
    }

    /**
     * Responsables d'un contrat (expiration, renouvellement) : chef(s) de
     * l'agence, chef du département, super-admins et direction générale actifs.
     *
     * @return array<int, string>
     */
    public function contractManagerIds(\App\Models\Contract $contract): array
    {
        $chiefs = collect($contract->agency_id ? $this->agencyChiefIds($contract->agency_id) : []);

        $departmentChiefs = $contract->department_id
            ? DB::table('user_assignments')->where('department_id', $contract->department_id)->where('is_department_chief', true)->pluck('user_id')
                ->merge(DB::table('department_chiefs')->where('department_id', $contract->department_id)->pluck('user_id'))
            : collect();

        $leaders = DB::table('users')
            ->join('roles', 'roles.id', '=', 'users.role_id')
            ->whereIn('roles.name', ['super-admin', 'direction-generale'])
            ->where('users.is_active', true)
            ->whereNull('users.deleted_at')
            ->pluck('users.id');

        return $chiefs->merge($departmentChiefs)->merge($leaders)->filter()->unique()->values()->all();
    }

    /**
     * Responsables d'une prestation : membres « lead » de l'équipe et compte
     * utilisateur du commercial vendeur.
     *
     * @return array<int, string>
     */
    public function prestationOwnerIds(Prestation $prestation): array
    {
        $leads = $prestation->teamMembers()->where('is_lead', true)->pluck('user_id');

        $commercialUserId = $prestation->commercial_id
            ? Commercial::whereKey($prestation->commercial_id)->value('user_id')
            : null;

        return $leads->push($commercialUserId)->filter()->unique()->values()->all();
    }
}
