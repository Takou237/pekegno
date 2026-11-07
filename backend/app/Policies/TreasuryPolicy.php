<?php

namespace App\Policies;

use App\Models\TreasuryAccount;
use App\Models\User;

/**
 * T2.3 — visibilité des caisses côté serveur.
 *
 * Les caisses Mobile Money et Banque (O/M/B) sont réservées à l'administration
 * et à la DG, même au sein de l'agence : la caissière ne doit jamais pouvoir
 * lire leurs soldes ni y transférer des fonds.
 */
class TreasuryPolicy
{
    public function view(User $user, TreasuryAccount $account): bool
    {
        return $account->isVisibleTo($user);
    }

    public function transfer(User $user, TreasuryAccount $account): bool
    {
        return $account->isVisibleTo($user);
    }
}
