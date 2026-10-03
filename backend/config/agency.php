<?php

return [
    /*
    | D1 : le contrat est l'objet central ; `subscriptions` passe en lecture seule.
    | À activer (AGENCY_SUBSCRIPTIONS_READ_ONLY=true) APRÈS avoir lancé la reprise
    | `php artisan agency:migrate-subscriptions` (D16), sinon les abonnements en
    | cours ne pourraient plus être renouvelés avant d'exister en contrats.
    */
    'subscriptions_read_only' => (bool) env('AGENCY_SUBSCRIPTIONS_READ_ONLY', false),
];
