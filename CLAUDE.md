# PEKEGNO

## Tests backend

Lancer les tests dans le conteneur PHP local (PHP 8.3) ; la machine hôte n'a que PHP 7.4 :

```bash
docker exec pekegno-server php artisan test
```

`phpunit.xml` fixe `memory_limit` à 1G (à 128 Mo, la suite complète s'arrêtait vers la fin).

Les tests utilisent SQLite en mémoire (`phpunit.xml`) : ils ne touchent pas la base Postgres locale.

**Avant de livrer, relancer aussi la suite sur PostgreSQL** : SQLite accepte des comparaisons
qu'on ne voit planter qu'en production (texte vs uuid, valeur hors contrainte CHECK…). Base jetable :

```bash
docker network create pgtest-net
docker run -d --name pgtest --network pgtest-net -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_USER=pekegno -e POSTGRES_DB=pekegno_tests postgres:16
cd backend && docker run --rm --network pgtest-net -e DB_CONNECTION=pgsql -e DB_HOST=pgtest \
  -e DB_DATABASE=pekegno_tests -e DB_USERNAME=pekegno -e DB_PASSWORD=secret \
  -v "$PWD":/app -w /app --entrypoint php pekegno-php artisan test
docker rm -f pgtest && docker network rm pgtest-net
```

La production est en **PostgreSQL 9.6** : `php artisan migrate` y échoue dès qu'une migration
modifie une colonne (`->change()` génère du SQL PostgreSQL 10+). Écrire ces changements en
`DB::statement` compatible 9.6, ou les livrer en SQL.

Après toute migration sur un serveur : `php artisan cache:clear`. Plusieurs listes de référence
(`/api/roles`, pays, catalogue…) sont mises en cache jusqu'à 1 h (`cache.response`) et une
migration qui écrit en base ne les invalide pas.

### Échecs connus (pas graves)

Environ 31 tests échouent en local. Ce sont des échecs connus, sans rapport avec une régression :
ne pas chercher à les corriger dans le cadre d'une autre tâche, seulement vérifier que leur liste
ne change pas avant/après une modification.

- **~31 tests — `GD extension is not installed.`** : l'image Docker locale (`docker/php/Dockerfile`)
  n'installe pas l'extension `gd`, nécessaire à `UploadedFile::fake()->image()` (preuves de paiement).
  L'image de production (`backend/Dockerfile`) l'installe. Fichiers concernés : `PayRemainingTest`,
  `Phase5CommercialValidationTest`, `EnrollmentValidationWorkflowTest`, `PendingInvoiceNotificationTest`,
  `PrestationSubmitWithProofTest`, `CashierAgencyActionsTest`, `Phase4ClientPortalTest`, `Phase7ReportingTest`.

### Règles de vente (T8.1) dans les tests

Toute ligne de facture doit avoir une catégorie, et toute vente un vendeur. Les tests qui vendent des
lignes libres utilisent le trait `Tests\Concerns\LineCategory` (`lineCategoryId()`, `fakeProof()` :
preuve PNG sans GD) et passent `'commercial_id' => auth()->id()`.

### Tâches planifiées

Cron en production : `* * * * * php artisan schedule:run` (liste : `php artisan schedule:list`).
`tests/Feature/ScheduledLifecycleTest.php` rejoue le cron jour par jour : rappels J-30/J-15/J-7/J-1,
« à renouveler », renouvellement automatique, expiration + clôture de prestation, statuts des
sessions et inscriptions terminées (`academy:refresh-statuses`).

