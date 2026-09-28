<?php
// Fichier temporaire : cree le lien symbolique public/storage -> storage/app/public
// (equivalent de `php artisan storage:link`, sans terminal).
// A televerser UNE FOIS dans backend/public/, visiter dans le navigateur, puis SUPPRIMER.

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

$status = $kernel->call('storage:link');

echo "Termine (code $status).<br>";
echo "Supprime ce fichier (setup-storage-link.php) maintenant via le Gestionnaire de fichiers.";
