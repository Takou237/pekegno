<?php
// Fichier temporaire : vide le cache OPcache du pool PHP-FPM qui sert le site.
// A televerser UNE FOIS dans backend/public/, visiter dans le navigateur, puis SUPPRIMER.

if (function_exists('opcache_reset')) {
    $ok = opcache_reset();
    echo $ok ? 'OPcache vide avec succes.' : 'opcache_reset() a renvoye false (opcache peut-etre deja vide ou desactive).';
} else {
    echo 'OPcache non disponible sur ce PHP (extension absente ou desactivee).';
}

echo '<br>Supprime ce fichier (reset-opcache.php) maintenant via le Gestionnaire de fichiers.';
