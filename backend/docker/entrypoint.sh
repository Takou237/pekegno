#!/bin/sh
set -e

# Les anciennes URL /storage/... dépendent de ce lien : ne pas masquer un échec.
if ! php artisan storage:link; then
  echo "ATTENTION: storage:link a échoué — les fichiers de storage/app/public ne seront pas servis sous /storage." >&2
fi
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

exec php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
