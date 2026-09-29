<?php
// Réparation des paiements d'inscription manquants (fichier TEMPORAIRE).
// 1. Téléverser dans repositories/pekegno/backend/public/
// 2. Ouvrir https://pekegnogroup.com/repair-enrollment-payments.php        -> simulation (ne modifie rien)
// 3. Si la liste est correcte : ...repair-enrollment-payments.php?apply=1  -> enregistre
// 4. SUPPRIMER ce fichier juste après.

header('Content-Type: text/plain; charset=utf-8');

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$apply = ($_GET['apply'] ?? '') === '1';
$kernel->call('invoices:repair-enrollment-payments', $apply ? ['--apply' => true] : []);
echo $kernel->output();

echo "\nSUPPRIME ce fichier (repair-enrollment-payments.php) maintenant.\n";
