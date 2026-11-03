-- ============================================================
-- PEKEGNO — Réparation production du 03/11/2026
--   (écritures comptables manquantes sur les versements de même montant)
--
-- Bug corrigé dans ce lot (AccountingService::recordIncomeFromPayment) :
--   le contrôle anti-doublon « une écriture de ce montant existe déjà pour la
--   facture » empêchait d'enregistrer en comptabilité un 2e versement du MÊME
--   montant que le 1er (ex. 100 000 + 100 000). Le versement existe bien
--   (invoice_payments, Bilan du jour, reçu) mais il manque son écriture
--   « Facture … — versement » dans accounting_transactions.
--
-- Cas identifiés dans le dump du 03/11/2026 (2 écritures, 130 000 FCFA) :
--   - PK-20261022-014 : 100 000 (om) du 02/11/2026 10h31
--   - PK-20261031-001 :  30 000 (cash) du 02/11/2026 11h46
--
-- Principe (générique : rattrape aussi les cas apparus après le dump) :
--   pour chaque facture validée non annulée et chaque montant, les versements
--   de ce montant (triés par date) au-delà du nombre d'écritures « income »
--   existantes de ce montant reçoivent leur écriture. Mêmes valeurs que le
--   code : libellé, référence, client, date = date du versement, opérateur =
--   encaisseur ; catégorie / département repris de l'écriture existante de la
--   facture (repli : catégorie système « income »).
--
-- Aucune migration, aucune permission, aucune route. Données seules.
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
-- Rejouable : au 2e passage, INSERT 0 0. Une seule transaction.
-- ============================================================

BEGIN;

-- Numérotation séquentielle sans conflit avec une écriture créée pendant l'import.
LOCK TABLE accounting_transactions IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO accounting_transactions (
  id, number, agency_id, department_id, category_id, type, label, reference,
  amount, client_id, invoice_id, transacted_at, operator_id, created_at, updated_at
)
SELECT
  md5(random()::text || clock_timestamp()::text || m.payment_id::text)::uuid,
  (SELECT COALESCE(MAX(number), 0) FROM accounting_transactions)
    + row_number() OVER (ORDER BY m.paid_at, m.payment_id),
  m.agency_id,
  (SELECT a.department_id FROM accounting_transactions a
     WHERE a.invoice_id = m.invoice_id AND a.type = 'income'
     ORDER BY a.transacted_at, a.number LIMIT 1),
  COALESCE(
    (SELECT a.category_id FROM accounting_transactions a
       WHERE a.invoice_id = m.invoice_id AND a.type = 'income' AND a.category_id IS NOT NULL
       ORDER BY a.transacted_at, a.number LIMIT 1),
    (SELECT c.id FROM accounting_categories c
       WHERE c.is_system AND c.type = 'income' AND c.agency_id IS NULL
       ORDER BY c.created_at, c.id LIMIT 1)
  ),
  'income',
  'Facture ' || m.invoice_number || ' — versement',
  m.invoice_number,
  m.amount,
  m.client_id,
  m.invoice_id,
  m.paid_at,
  m.received_by,
  (now() AT TIME ZONE 'UTC')::timestamp(0),
  (now() AT TIME ZONE 'UTC')::timestamp(0)
FROM (
  SELECT p.id AS payment_id, p.invoice_id, p.amount, p.paid_at, p.received_by,
         i.number AS invoice_number, i.agency_id, i.client_id,
         row_number() OVER (PARTITION BY p.invoice_id, p.amount
                            ORDER BY p.paid_at, p.created_at, p.id) AS rk,
         (SELECT COUNT(*) FROM accounting_transactions a
            WHERE a.invoice_id = p.invoice_id AND a.type = 'income'
              AND a.reference = i.number AND a.amount = p.amount) AS existing
  FROM invoice_payments p
  JOIN invoices i ON i.id = p.invoice_id
  WHERE i.validation_status = 'validated' AND i.cancelled_at IS NULL
) m
WHERE m.rk > m.existing;

COMMIT;

-- ------------------------------------------------------------
-- Contrôles (boîte SQL → SELECT uniquement) :
-- SELECT number, reference, amount, transacted_at FROM accounting_transactions
--   WHERE reference IN ('PK-20261022-014', 'PK-20261031-001') ORDER BY reference, transacted_at;
--   -- 2 lignes par facture (100 000 ×2 ; 30 000 ×2)
-- ------------------------------------------------------------
