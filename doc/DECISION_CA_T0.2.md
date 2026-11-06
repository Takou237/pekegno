# T0.2 — Décision écrite : doctrine du chiffre d'affaires

> **Référence** : `doc/PLAN_TRAVAIL_CORRECTIONS_WORLDEV_V1.md`, section 1.3 et tâche T0.2.
> **Date** : 6 novembre 2026.
> **Statut** : décision technique arrêtée, **à contresigner par la Direction Pekegno**.

## 1. Décision

Le chiffre d'affaires (CA) Pekegno est défini **par les factures validées**, et non par
les encaissements :

```
CA de la période = Σ invoices.total_amount
                   des factures validation_status = validated
                   non annulées (cancelled_at IS NULL)
                   dont invoice_date est dans la période
                   hors lignes pass-through (budget publicitaire client)
```

L'**encaissé** est une ligne distincte, calculée sur les paiements :

```
Encaissé de la période = Σ invoice_payments.amount
                         des paiements validés (validation_status = validated, non annulés)
                         dont la date de réception est dans la période
                         sur factures validées non annulées
```

Le contrôle comptable obligatoire, testé automatiquement, est :

```
CA = Encaissé sur les factures de la période + Impayés
```

avec :

```
Impayés = Σ (total_amount − amount_paid)
          des factures validées de la période au statut unpaid / partial
```

## 2. Précisions par indicateur

| Indicateur | Définition retenue |
|---|---|
| `ca` | Factures validées non annulées de la période, hors pass-through. |
| `encaisse` | Paiements validés reçus pendant la période, sur factures validées non annulées. |
| `dont_recouvrements` | Part de `encaisse` concernant des factures datées d'avant la période. |
| `acomptes` | Paiements `is_advance = true` sur des factures de la période non soldées. |
| `impayes` | Reste à payer des factures validées de la période. |
| `depenses` | Sorties de la période, **hors transferts entre caisses**. |
| `en_attente_validation` | Montants annoncés sur factures `pending` (avance déclarée). |
| `net_caisse` | `encaisse − depenses`. |
| `panier_moyen` | `ca ÷ nombre de factures validées de la période`. |

## 3. Règles transverses

1. **Un seul service** : `App\Services\FinancialMetricsService` est la seule source de
   calcul. Les tableaux de bord, bilans, rapports et exports le consomment.
2. **Une seule période métier** : `App\Support\Period` (fuseau `app.business_timezone`,
   par défaut `Africa/Douala`).
3. **Arrondi au franc** : `App\Support\Money::franc()` à l'affichage et dans les
   agrégats exposés ; les décimales restent en base pour la réconciliation.
4. **Devise** : monnaie locale dès qu'un pays / une ville / une agence est sélectionné ;
   conversion groupe via `countries.exchange_rate` sinon.
5. **Date d'un paiement** : `received_at` (date de réception). Pour les données
   historiques, `received_at` est initialisé à `paid_at`.
6. **Rien n'est supprimé** : une facture annulée conserve ses paiements, marqués
   `cancelled_at`, et ses contre-passations comptables.

## 4. Conséquences

- Les commissions et primes **ne sont pas recalculées** avant que ce calcul soit
  déployé et vérifié sur staging (cf. plan, Lot 7).
- Les écrans qui utilisaient encore l'encaissé comme CA sont rebranchés sur
  `FinancialMetricsService`.
- Toute divergence entre deux écrans sur le même périmètre et la même période est
  considérée comme un bug bloquant.

## 5. Mise en œuvre (Lot 1)

| Élément | État |
|---|---|
| `App\Services\FinancialMetricsService` (source unique, 8 indicateurs + alias historiques) | Fait |
| `invoice_payments.received_at`, `validated_at`, `validation_status` (migration + modèle) | Fait |
| Arrondi centralisé `App\Support\Money` | Fait |
| `App\Services\RevenueService` transformé en façade (constantes + délégation) | Fait |
| Endpoint unique `GET /api/metrics/summary` et `GET /api/metrics/breakdown` | Fait |
| Invariant CA = encaissé période + impayés (tests automatiques, cas limites) | Fait — `tests/Feature/FinancialMetricsConsistencyTest.php` |
| Ventilation en 7 rubriques (`sale_rubrics`) | Reporté — dépend de T3.6 |
| `treasury_account_id` strictement obligatoire à la saisie | Reporté — résolution method-aware en place ; durcissement en T2.5 avec la refonte des caisses C/O/M et l'écran de paiement |
| Cartes frontend | Déjà servies par `/stats/*` et `/dashboard`, rebranchés sur le service unique ; `/api/metrics/summary` disponible pour la consolidation |

## 6. Validation

| Partie | Nom | Date | Signature |
|---|---|---|---|
| Direction Pekegno | | | |
| WORLDEV (technique) | | | |
