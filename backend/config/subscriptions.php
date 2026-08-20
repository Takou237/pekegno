<?php

return [
    /*
    | Calendrier configurable des rappels d'expiration (§18 spec).
    | Clé = type de notification, valeur = nombre de jours avant l'expiration.
    */
    'notifications' => [
        'channels' => ['in-app'],

        'schedule' => [
            '14_days' => 14,
            '7_days' => 7,
            '2_days' => 2,
            '1_day' => 1,
            'expired' => 0,
        ],

        'expiring_soon_days' => 30,
    ],
];