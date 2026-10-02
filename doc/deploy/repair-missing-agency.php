<?php
// Rattache à une agence les factures sans agence (bilan du jour, caisse, comptabilité) (fichier TEMPORAIRE).
// 1. Téléverser dans repositories/pekegno/backend/public/
// 2. Ouvrir https://pekegnogroup.com/repair-missing-agency.php        -> simulation (ne modifie rien)
// 3. Si la liste est correcte : ...repair-missing-agency.php?apply=1  -> enregistre
// 4. SUPPRIMER ce fichier juste après.

header('Content-Type: text/plain; charset=utf-8');

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$apply = ($_GET['apply'] ?? '') === '1';
$kernel->call('invoices:repair-missing-agency', $apply ? ['--apply' => true] : []);
echo $kernel->output();

echo "\nSUPPRIME ce fichier (repair-missing-agency.php) maintenant.\n";
