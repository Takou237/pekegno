<?php
// Calcul des primes mensuelles des règles de commission par rôle
// (CA mensuel par paliers, croissance vs N-1) — fichier TEMPORAIRE.
// 1. Téléverser dans repositories/pekegno/backend/public/
// 2. Ouvrir https://pekegnogroup.com/compute-role-commissions.php              -> mois précédent
//    ou    https://pekegnogroup.com/compute-role-commissions.php?period=2026-10 -> mois choisi (AAAA-MM)
// 3. SUPPRIMER ce fichier juste après.
// Relançable sans doublon : les primes encore « calculées » sont recalculées,
// celles déjà validées ou payées ne sont jamais modifiées.

header('Content-Type: text/plain; charset=utf-8');

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$period = (string) ($_GET['period'] ?? '');
if ($period !== '' && ! preg_match('/^\d{4}-\d{2}$/', $period)) {
    echo "Période invalide : attendu AAAA-MM (ex. 2026-10).\n";
    exit;
}

$kernel->call('commissions:compute-period', $period !== '' ? ['period' => $period] : []);
echo $kernel->output();

echo "\nSUPPRIME ce fichier (compute-role-commissions.php) maintenant.\n";
