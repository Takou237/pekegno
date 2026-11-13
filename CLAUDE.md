# PEKEGNO

## Tests backend

Lancer les tests dans le conteneur PHP local (PHP 8.3) ; la machine hôte n'a que PHP 7.4 :

```bash
docker exec pekegno-server php -d memory_limit=1G artisan test
```

Sans `-d memory_limit=1G`, la suite complète s'arrête vers la fin (mémoire épuisée, 128 Mo).

Les tests utilisent SQLite en mémoire (`phpunit.xml`) : ils ne touchent pas la base Postgres locale.

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

