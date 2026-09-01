<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;

class NotificationService
{
    /**
     * Crée une notification pour un utilisateur précis.
     */
    public function notify(User $user, string $title, ?string $message = null, ?string $link = null, string $type = 'info'): AppNotification
    {
        return AppNotification::create([
            'user_id' => $user->id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'link' => $link,
        ]);
    }

    /**
     * Notifie tous les utilisateurs actifs qui ont au moins une des permissions
     * fournies (ex. 'orders.valider'). Utile pour alerter les caissières /
     * responsables d'une commande soumise en attente de validation.
     */
    public function notifyByPermission(array $permissions, string $title, ?string $message = null, ?string $link = null, string $type = 'info'): Collection
    {
        $roles = Role::whereHas('permissions', fn ($q) => $q->whereIn('name', $permissions))
            ->pluck('id');

        $users = User::where('is_active', true)
            ->whereIn('role_id', $roles)
            ->get();

        $created = collect();

        foreach ($users as $user) {
            $created->push(
                $this->notify($user, $title, $message, $link, $type)
            );
        }

        return $created;
    }

    /**
     * Notifie l'utilisateur qui a déclenché une action (ex. la validation d'une
     * commande) ainsi que le commercial associé à la commande.
     */
    public function notifyUserIds(array $userIds, string $title, ?string $message = null, ?string $link = null, string $type = 'info'): Collection
    {
        $created = collect();

        foreach (array_unique($userIds) as $userId) {
            if (! $userId) {
                continue;
            }
            $created->push(
                AppNotification::create([
                    'user_id' => $userId,
                    'type' => $type,
                    'title' => $title,
                    'message' => $message,
                    'link' => $link,
                ])
            );
        }

        return $created;
    }
}
