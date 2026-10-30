# PEKEGNO

## Tests backend

Lancer les tests dans le conteneur PHP local (PHP 8.3) ; la machine hôte n'a que PHP 7.4 :

```bash
docker exec pekegno-server php artisan test
```

Les tests utilisent SQLite en mémoire (`phpunit.xml`) : ils ne touchent pas la base Postgres locale.

### Échecs connus (pas graves)

Environ 37 tests échouent en local. Ce sont des échecs connus, sans rapport avec une régression :
ne pas chercher à les corriger dans le cadre d'une autre tâche, seulement vérifier que leur liste
ne change pas avant/après une modification.

- **~31 tests — `GD extension is not installed.`** : l'image Docker locale (`docker/php/Dockerfile`)
  n'installe pas l'extension `gd`, nécessaire à `UploadedFile::fake()->image()` (preuves de paiement).
  L'image de production (`backend/Dockerfile`) l'installe. Fichiers concernés : `PayRemainingTest`,
  `Phase5CommercialValidationTest`, `EnrollmentValidationWorkflowTest`, `PendingInvoiceNotificationTest`,
  `PrestationSubmitWithProofTest`, `CashierAgencyActionsTest`, `Phase4ClientPortalTest`, `Phase7ReportingTest`.
- **5 tests — preuve de paiement obligatoire pour `responsable-agence`** : `ManagerSalesTest` (2),
  `Phase3ValidationWorkflowTest` (1), `Phase5BilanTest` (2) vendent avec ce rôle sans preuve, alors que
  la règle métier l'exige désormais (`InvoiceController`, `$needsPaymentProof`). Tests à mettre à jour.
- **1 test — `ClientPackageSubscriptionTest::test_subscribe_validates_payload_and_minimum_duration`** :
  attend un 422 pour une avance supérieure au total ; le code plafonne l'avance au total
  (`PackageService`). Comportement à trancher.
