-- ============================================================
-- PEKEGNO — Mise à jour production du 08/11/2026
--   (branche `corrections` : socle financier unique, caisses codifiées,
--    clôture journalière, transferts, bugs P1 du cahier WORLDEV)
-- État prod de départ : lot `04_11(2)/` appliqué + correctifs master
--   20a2abe et d923245 (dernière migration en prod : 2026_11_04_000001).
--
-- Contenu : 6 migrations Laravel + 1 droit :
--   A. 2026_11_05_000001  invoice_payments.cancelled_at
--      Paiement annulé avec sa facture (B9).
--   B. 2026_11_06_000001  invoice_payments.received_at / validated_at / validation_status
--      Date de réception de l'argent ≠ date de validation (B11). Les
--      paiements existants reçoivent paid_at dans les deux dates.
--   C. 2026_11_06_000002  treasury_accounts.code / visible_roles
--      Caisses codifiées C/O/M/B/W/V ; O, M, B… invisibles pour la caissière.
--   D. 2026_11_06_000003  treasury_transactions.transfer_type
--      Type de transfert (versement banque, décaissement administratif…).
--   E. 2026_11_06_000004  table cash_closings
--      Clôture journalière de chaque caisse.
--   F. 2026_11_07_000001  accounting_transactions.treasury_account_id / is_transfer
--      Caisse obligatoire sur les dépenses ; versement en banque = transfert (B13).
--   G. Droit : caissier → tresories.consulter et tresories.modifier
--      (RoleSeeder : la caissière voit et clôture sa caisse C).
--
-- ⚠ Le code de `corrections` lit ces colonnes sur les factures, paiements,
--   bilans, tableaux de bord et la comptabilité : importer ce fichier
--   JUSTE APRÈS le `git pull`, sinon ces pages renvoient une erreur 500.
--
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
-- Rejouable sans erreur (IF NOT EXISTS / contraintes protégées). Une seule
-- transaction : en cas d'erreur, rien n'est modifié.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. Paiement annulé — 2026_11_05_000001
-- ------------------------------------------------------------
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS cancelled_at timestamp(0) without time zone NULL;

-- ------------------------------------------------------------
-- B. Date de réception / validation — 2026_11_06_000001
-- ------------------------------------------------------------
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS received_at timestamp(0) without time zone NULL;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS validated_at timestamp(0) without time zone NULL;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS validation_status varchar(20) NOT NULL DEFAULT 'validated';
CREATE INDEX IF NOT EXISTS invoice_payments_received_at_index ON invoice_payments (received_at);
CREATE INDEX IF NOT EXISTS invoice_payments_validation_status_index ON invoice_payments (validation_status);
UPDATE invoice_payments SET received_at = paid_at, validated_at = paid_at WHERE received_at IS NULL;

-- ------------------------------------------------------------
-- C. Caisses codifiées — 2026_11_06_000002
--    Code par caisse (C espèces, B banque, O Orange Money, M MTN, W Wave,
--    V Moov, X autre), suffixé 2, 3… si l'agence a plusieurs caisses du même
--    type. Hors espèces : visibles seulement par super-admin, DG, comptable.
-- ------------------------------------------------------------
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS code varchar(5) NULL;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS visible_roles json NULL;

WITH coded AS (
  SELECT id,
         CASE
           WHEN type = 'cash' THEN 'C'
           WHEN type = 'bank' THEN 'B'
           WHEN provider = 'orange_money' THEN 'O'
           WHEN provider = 'mtn_momo' THEN 'M'
           WHEN provider = 'wave' THEN 'W'
           WHEN provider = 'moov_money' THEN 'V'
           ELSE 'X'
         END AS base,
         type,
         agency_id,
         created_at
  FROM treasury_accounts
  WHERE code IS NULL
), numbered AS (
  SELECT id, type, base,
         row_number() OVER (PARTITION BY COALESCE(agency_id::text, 'global'), base ORDER BY created_at, id) AS rn
  FROM coded
)
UPDATE treasury_accounts t
SET code = n.base || CASE WHEN n.rn > 1 THEN n.rn::text ELSE '' END,
    visible_roles = CASE WHEN n.type = 'cash' THEN NULL
                         ELSE '["super-admin","direction-generale","comptable"]'::json END
FROM numbered n
WHERE t.id = n.id;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treasury_accounts_agency_id_code_unique') THEN ALTER TABLE treasury_accounts ADD CONSTRAINT treasury_accounts_agency_id_code_unique UNIQUE (agency_id, code); END IF; END $$;

-- ------------------------------------------------------------
-- D. Type de transfert — 2026_11_06_000003
-- ------------------------------------------------------------
ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS transfer_type varchar(30) NULL;

-- ------------------------------------------------------------
-- E. Clôtures de caisse — 2026_11_06_000004
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_closings (
  id uuid NOT NULL PRIMARY KEY,
  agency_id uuid NULL,
  treasury_account_id uuid NOT NULL,
  closing_date date NOT NULL,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  theoretical_balance numeric(14,2) NOT NULL DEFAULT 0,
  actual_balance numeric(14,2) NOT NULL DEFAULT 0,
  difference numeric(14,2) NOT NULL DEFAULT 0,
  justification text NULL,
  status varchar(20) NOT NULL DEFAULT 'closed',
  closed_by uuid NULL,
  validated_by uuid NULL,
  validated_at timestamp(0) without time zone NULL,
  created_at timestamp(0) without time zone NULL,
  updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_closings_agency_id_foreign') THEN ALTER TABLE cash_closings ADD CONSTRAINT cash_closings_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_closings_treasury_account_id_foreign') THEN ALTER TABLE cash_closings ADD CONSTRAINT cash_closings_treasury_account_id_foreign FOREIGN KEY (treasury_account_id) REFERENCES treasury_accounts(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_closings_closed_by_foreign') THEN ALTER TABLE cash_closings ADD CONSTRAINT cash_closings_closed_by_foreign FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_closings_validated_by_foreign') THEN ALTER TABLE cash_closings ADD CONSTRAINT cash_closings_validated_by_foreign FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_closings_treasury_account_id_closing_date_unique') THEN ALTER TABLE cash_closings ADD CONSTRAINT cash_closings_treasury_account_id_closing_date_unique UNIQUE (treasury_account_id, closing_date); END IF; END $$;
CREATE INDEX IF NOT EXISTS cash_closings_agency_id_closing_date_index ON cash_closings (agency_id, closing_date);

-- ------------------------------------------------------------
-- F. Caisse et transfert sur les écritures — 2026_11_07_000001
-- ------------------------------------------------------------
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS treasury_account_id uuid NULL;
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS is_transfer boolean NOT NULL DEFAULT false;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_transactions_treasury_account_id_foreign') THEN ALTER TABLE accounting_transactions ADD CONSTRAINT accounting_transactions_treasury_account_id_foreign FOREIGN KEY (treasury_account_id) REFERENCES treasury_accounts(id) ON DELETE SET NULL; END IF; END $$;
CREATE INDEX IF NOT EXISTS accounting_transactions_type_is_transfer_index ON accounting_transactions (type, is_transfer);

-- ------------------------------------------------------------
-- G. Droit trésorerie de la caissière (RoleSeeder)
-- ------------------------------------------------------------
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('tresories.consulter', 'tresories.modifier')
WHERE r.name = 'caissier'
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ------------------------------------------------------------
-- H. Marque les migrations comme exécutées (évite tout rejeu via artisan)
-- ------------------------------------------------------------
INSERT INTO migrations (migration, batch)
SELECT v.m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES
  ('2026_11_05_000001_add_cancelled_at_to_invoice_payments_table'),
  ('2026_11_06_000001_add_received_validated_at_to_invoice_payments_table'),
  ('2026_11_06_000002_add_code_and_visibility_to_treasury_accounts'),
  ('2026_11_06_000003_add_transfer_type_to_treasury_transactions'),
  ('2026_11_06_000004_create_cash_closings_table'),
  ('2026_11_07_000001_add_treasury_and_transfer_to_accounting_transactions')
) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);

COMMIT;

-- ------------------------------------------------------------
-- Contrôles (boîte SQL → SELECT uniquement) :
-- SELECT migration FROM migrations WHERE migration > '2026_11_04_000001' ORDER BY migration;  -- 6 lignes
-- SELECT agency_id, code, type, provider FROM treasury_accounts ORDER BY agency_id, code;    -- aucun code vide
-- SELECT COUNT(*) FROM invoice_payments WHERE received_at IS NULL;                            -- 0
-- SELECT p.name FROM role_permission rp JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id WHERE r.name = 'caissier' AND p.name LIKE 'tresories.%';  -- 2 lignes
-- ------------------------------------------------------------
