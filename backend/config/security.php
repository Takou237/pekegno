<?php

return [
    /*
     * Adresses des développeurs autorisés à intervenir en production.
     * Vide par défaut : le centre de sécurité affiche alors une liste vide.
     */
    'developer_emails' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('SECURITY_DEVELOPER_EMAILS', ''))
    ))),

    /*
     * Double authentification obligatoire pour les rôles sensibles.
     * Activée par défaut hors environnement de test ; les tests ne sont pas
     * bloqués (ils authentifient des rôles sensibles sans 2FA).
     */
    'enforce_two_factor' => (bool) env(
        'SECURITY_ENFORCE_2FA',
        env('APP_ENV') !== 'testing'
    ),
];
