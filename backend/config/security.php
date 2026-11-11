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
     *
     * Lot 9 désactivé le 11/11/2026 (décision Pekegno) — à réactiver plus tard.
     * Désactivée par défaut. Pour la réactiver : SECURITY_ENFORCE_2FA=true dans
     * le .env, décommenter le middleware « two_factor.enrolled » et la route
     * /security/center (routes/api.php), le menu et la route « /security » du
     * frontend (navItems.ts, router/index.tsx), et retirer le markTestSkipped
     * de TwoFactorEnforcementTest / SecurityCenterTest.
     */
    'enforce_two_factor' => (bool) env('SECURITY_ENFORCE_2FA', false),
];
