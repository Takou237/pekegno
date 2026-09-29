<?php
// Diagnostic des emails (fichier TEMPORAIRE).
// 1. Téléverser dans repositories/pekegno/backend/public/
// 2. Ouvrir https://pekegnogroup.com/mail-test.php
// 3. SUPPRIMER ce fichier juste après.
// N'envoie qu'à l'adresse MAIL_FROM_ADDRESS (jamais à une adresse passée en paramètre).

header('Content-Type: text/plain; charset=utf-8');

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$cfg = config('mail.mailers.smtp');
echo "=== Configuration chargée par Laravel ===\n";
echo 'Config en cache (bootstrap/cache/config.php) : '.(file_exists(base_path('bootstrap/cache/config.php')) ? 'OUI -> le .env est ignoré tant que ce fichier existe' : 'non')."\n";
echo 'MAIL_MAILER : '.config('mail.default')."\n";
echo 'Hôte / port / scheme : '.$cfg['host'].' / '.$cfg['port'].' / '.($cfg['scheme'] ?? '-')."\n";
echo 'Utilisateur : '.($cfg['username'] ?: '(vide)')."\n";
echo 'Mot de passe renseigné : '.($cfg['password'] ? 'oui' : 'NON')."\n";
echo 'Expéditeur : '.config('mail.from.address')."\n\n";

echo "=== Connexions réseau sortantes ===\n";
$targets = [
    [$cfg['host'], (int) $cfg['port']],
    ['smtp.gmail.com', 465],
    ['smtp.gmail.com', 587],
    ['localhost', 465],
    ['localhost', 587],
];
foreach ($targets as [$host, $port]) {
    $prefix = $port === 465 ? 'ssl://' : '';
    $errno = 0;
    $errstr = '';
    $fp = @stream_socket_client($prefix.$host.':'.$port, $errno, $errstr, 8);
    echo str_pad("$host:$port", 26).($fp ? 'OK' : "ÉCHEC ($errstr)")."\n";
    if ($fp) {
        fclose($fp);
    }
}

echo "\n=== Envoi d'un email de test à ".config('mail.from.address')." ===\n";
try {
    Illuminate\Support\Facades\Mail::raw('Test PEKEGNO : si vous lisez ceci, les emails fonctionnent.', function ($m) {
        $m->to(config('mail.from.address'))->subject('Test email PEKEGNO');
    });
    echo "Envoyé sans erreur. Vérifier la boîte de réception (et les spams).\n";
} catch (Throwable $e) {
    echo 'ERREUR : '.get_class($e)."\n".$e->getMessage()."\n";
}

echo "\n=== 5 dernières erreurs mail dans storage/logs/laravel.log ===\n";
$log = storage_path('logs/laravel.log');
if (is_readable($log)) {
    $lines = preg_grep('/Mailer|Transport|smtp|envoi de l.email|Connection (refused|timed out)/i', file($log));
    foreach (array_slice($lines, -5) as $line) {
        echo substr($line, 0, 400)."\n";
    }
} else {
    echo "(aucun log)\n";
}

echo "\nSUPPRIME ce fichier (mail-test.php) maintenant.\n";
