# PEKEGNO

## Tests backend

Lancer les tests dans le conteneur PHP local (PHP 8.3) ; la machine hôte n'a que PHP 7.4 :

```bash
docker exec pekegno-server php artisan test
```

Les tests utilisent SQLite en mémoire (`phpunit.xml`) : ils ne touchent pas la base Postgres locale.

### Échecs connus (pas graves)

Environ 32 tests échouent en local. Ce sont des échecs connus, sans rapport avec une régression :
ne pas chercher à les corriger dans le cadre d'une autre tâche, seulement vérifier que leur liste
ne change pas avant/après une modification.

- **~31 tests — `GD extension is not installed.`** : l'image Docker locale (`docker/php/Dockerfile`)
  n'installe pas l'extension `gd`, nécessaire à `UploadedFile::fake()->image()` (preuves de paiement).
  L'image de production (`backend/Dockerfile`) l'installe. Fichiers concernés : `PayRemainingTest`,
  `Phase5CommercialValidationTest`, `EnrollmentValidationWorkflowTest`, `PendingInvoiceNotificationTest`,
  `PrestationSubmitWithProofTest`, `CashierAgencyActionsTest`, `Phase4ClientPortalTest`, `Phase7ReportingTest`.
- **1 test — `ClientPackageSubscriptionTest::test_subscribe_validates_payload_and_minimum_duration`** :
  attend un 422 pour une avance supérieure au total ; le code plafonne l'avance au total
  (`PackageService`). Comportement à trancher.

### Règles de vente (T8.1) dans les tests

Toute ligne de facture doit avoir une catégorie, et toute vente un vendeur. Les tests qui vendent des
lignes libres utilisent le trait `Tests\Concerns\LineCategory` (`lineCategoryId()`, `fakeProof()` :
preuve PNG sans GD) et passent `'commercial_id' => auth()->id()`.

