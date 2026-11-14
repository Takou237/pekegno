<?php
// SITE DE TEST UNIQUEMENT — script temporaire (sans terminal).
// 1. Remplacer CHANGE-MOI ci-dessous par un mot de passe a soi.
// 2. Televerser dans repositories/pekegno_test/backend/public/
// 3. Visiter https://api.test.pekegnogroup.com/deploy-test.php?token=<ton mot>
//    -> etat des migrations ; ajouter &run=1 pour les appliquer.
// 4. SUPPRIMER ce fichier ensuite.

const TOKEN = 'CHANGE-MOI';

if (TOKEN === 'CHANGE-MOI' || ! hash_equals(TOKEN, (string) ($_GET['token'] ?? ''))) {
    http_response_code(403);
    exit('Acces refuse.');
}

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

header('Content-Type: text/plain; charset=utf-8');

$db = config('database.connections.'.config('database.default').'.database');
echo "Base : {$db}\n";
if (! str_contains((string) $db, 'test')) {
    exit("ARRET : la base configuree n'est pas une base de test. Verifier DB_DATABASE dans le .env.\n");
}

$run = ($_GET['run'] ?? '') === '1';
$steps = $run
    ? ['migrate' => ['--force' => true], 'storage:link' => [], 'route:clear' => [], 'config:clear' => [], 'migrate:status' => []]
    : ['migrate:status' => []];

foreach ($steps as $command => $args) {
    echo "\n===== php artisan {$command} =====\n";
    try {
        $kernel->call($command, $args);
        echo $kernel->output();
    } catch (Throwable $e) {
        echo 'ERREUR : '.$e->getMessage()."\n";
        if ($command === 'migrate') {
            exit("\nMigration interrompue : envoyer ce message pour diagnostic.\n");
        }
    }
}

if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "\nOPcache vide.\n";
}
echo $run ? "\nTermine. SUPPRIMER deploy-test.php maintenant.\n" : "\nAjouter &run=1 a l'adresse pour appliquer les migrations.\n";
