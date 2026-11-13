-- ============================================================
-- PEKEGNO - Mise a jour du 12/11/2026 (branche `corrections`)
--   Lots 3 (Administration, publicite, evenement) et 7 (seances,
--   creance echue) + matrice de droits T0.6.
--
-- Etat de depart attendu : lot `08_11/` applique
--   (derniere migration : 2026_11_10_000003).
--
-- Contenu : 9 migrations Laravel
--   A. 2026_11_12_000001  countries.phone_code (L5 : saisie du telephone)
--   B. 2026_11_12_000002  payment_proofs.rejection_code (B25 : motif ferme)
--   C. 2026_11_12_000003  matrice de droits community-manager / caissier (T0.6)
--   D. 2026_11_12_000004  expenses.is_pass_through / invoice_id (T3.12)
--      + accounting_transactions.is_pass_through
--   E. 2026_11_12_000005  expenses.service_id (T3.14 : rentabilite evenement)
--   F. 2026_11_12_000006  table ad_campaigns + expenses.ad_campaign_id (T3.8)
--   G. 2026_11_12_000007  attendances.session_date (T7.3 : appel par seance)
--   H. 2026_11_12_000008  agencies.type = 'administration' (T3.1)
--   I. 2026_11_12_000009  invoices.due_date (creance echue)
--
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin -> onglet
-- "Importer" (jamais copier-coller dans la boite SQL).
-- Rejouable sans erreur (IF NOT EXISTS / contraintes protegees).
-- Une seule transaction : en cas d'erreur, rien n'est modifie.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. Indicatifs pays (L5)
-- ------------------------------------------------------------
UPDATE countries
SET phone_code = '+237'
WHERE code = 'CMR' AND (phone_code IS NULL OR phone_code = '');

UPDATE countries
SET phone_code = '+225'
WHERE code = 'CIV' AND (phone_code IS NULL OR phone_code = '');

-- ------------------------------------------------------------
-- B. Motif de rejet ferme sur les preuves de paiement (B25)
-- ------------------------------------------------------------
ALTER TABLE payment_proofs
    ADD COLUMN IF NOT EXISTS rejection_code VARCHAR(40) NULL;

-- ------------------------------------------------------------
-- C. Matrice de droits T0.6
--    - community-manager : executant de prestations (plus de vente)
--    - caissier : plus de suppression de client, comptabilite en lecture
-- ------------------------------------------------------------
DELETE FROM role_permission
WHERE role_id IN (SELECT id FROM roles WHERE name = 'community-manager');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'clients.consulter',
    'services.consulter',
    'products.consulter',
    'categories.consulter',
    'packages.consulter',
    'prestations.consulter',
    'prestation-actions.consulter',
    'prestation-actions.modifier',
    'equipe-client.consulter',
    'courses.consulter',
    'sessions.consulter',
    'enrollments.consulter',
    'presences.consulter',
    'modules.consulter'
)
WHERE r.name = 'community-manager';

DELETE FROM role_permission
WHERE role_id IN (SELECT id FROM roles WHERE name = 'caissier')
  AND permission_id IN (
      SELECT id FROM permissions WHERE name IN (
          'clients.supprimer',
          'comptabilite.creer',
          'comptabilite.modifier',
          'comptabilite.supprimer',
          'accounting-categories.creer',
          'accounting-categories.modifier',
          'accounting-categories.supprimer'
      )
  );

-- ------------------------------------------------------------
-- D. Budget publicitaire client en pass-through (T3.12)
-- ------------------------------------------------------------
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS is_pass_through BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS invoice_id UUID NULL;

CREATE INDEX IF NOT EXISTS expenses_invoice_id_index
    ON expenses (invoice_id);

ALTER TABLE accounting_transactions
    ADD COLUMN IF NOT EXISTS is_pass_through BOOLEAN NOT NULL DEFAULT FALSE;

-- ------------------------------------------------------------
-- E. Depense rattachee a un service (T3.14 rentabilite evenement)
-- ------------------------------------------------------------
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS service_id UUID NULL;

CREATE INDEX IF NOT EXISTS expenses_service_id_index
    ON expenses (service_id);

-- ------------------------------------------------------------
-- F. Campagnes publicitaires Pekegno (T3.8)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id           UUID NOT NULL,
    name         VARCHAR(255) NOT NULL,
    branch       VARCHAR(255) NOT NULL,
    country_id   UUID NOT NULL,
    is_national  BOOLEAN NOT NULL DEFAULT FALSE,
    agency_id    UUID NULL,
    budget       DECIMAL(15, 2) NOT NULL DEFAULT 0,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    status       VARCHAR(30) NOT NULL DEFAULT 'active',
    description  TEXT NULL,
    expense_id   UUID NULL,
    created_at   TIMESTAMP(0) WITHOUT TIME ZONE NULL,
    updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NULL,
    deleted_at   TIMESTAMP(0) WITHOUT TIME ZONE NULL,
    PRIMARY KEY (id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ad_campaigns_country_id_foreign'
    ) THEN
        ALTER TABLE ad_campaigns
            ADD CONSTRAINT ad_campaigns_country_id_foreign
            FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ad_campaigns_agency_id_foreign'
    ) THEN
        ALTER TABLE ad_campaigns
            ADD CONSTRAINT ad_campaigns_agency_id_foreign
            FOREIGN KEY (agency_id) REFERENCES agencies (id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ad_campaigns_country_id_branch_index
    ON ad_campaigns (country_id, branch);

CREATE INDEX IF NOT EXISTS ad_campaigns_is_national_status_index
    ON ad_campaigns (is_national, status);

CREATE INDEX IF NOT EXISTS ad_campaigns_start_date_end_date_index
    ON ad_campaigns (start_date, end_date);

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS ad_campaign_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'expenses_ad_campaign_id_foreign'
    ) THEN
        ALTER TABLE expenses
            ADD CONSTRAINT expenses_ad_campaign_id_foreign
            FOREIGN KEY (ad_campaign_id) REFERENCES ad_campaigns (id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS expenses_ad_campaign_id_index
    ON expenses (ad_campaign_id);

-- ------------------------------------------------------------
-- G. Date de seance sur les presences (T7.3)
--    L'ancienne unicite (session, module, apprenant) est remplacee par
--    (session, module, date, apprenant). Les presences historiques ont
--    session_date NULL : a dater manuellement si necessaire.
-- ------------------------------------------------------------
ALTER TABLE attendances
    ADD COLUMN IF NOT EXISTS session_date DATE NULL;

ALTER TABLE attendances
    DROP CONSTRAINT IF EXISTS attendances_session_module_learner_unique;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'attendances_session_module_date_learner_unique'
    ) THEN
        ALTER TABLE attendances
            ADD CONSTRAINT attendances_session_module_date_learner_unique
            UNIQUE (training_session_id, course_module_id, session_date, learner_user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS attendances_training_session_id_session_date_index
    ON attendances (training_session_id, session_date);

-- ------------------------------------------------------------
-- H. Type d'agence "administration" (T3.1)
-- ------------------------------------------------------------
ALTER TABLE agencies
    DROP CONSTRAINT IF EXISTS agencies_type_check;

ALTER TABLE agencies
    ADD CONSTRAINT agencies_type_check
    CHECK (type IN ('agency', 'academy', 'mixed', 'administration'));

-- ------------------------------------------------------------
-- I. Echeance de facture (creance echue)
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS due_date DATE NULL;

CREATE INDEX IF NOT EXISTS invoices_due_date_index
    ON invoices (due_date);

-- ------------------------------------------------------------
-- Enregistrement des migrations (batch suivant)
-- ------------------------------------------------------------
INSERT INTO migrations (migration, batch)
SELECT v.m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES
    ('2026_11_12_000001_backfill_country_phone_codes'),
    ('2026_11_12_000002_add_rejection_code_to_payment_proofs_table'),
    ('2026_11_12_000003_apply_role_permission_matrix'),
    ('2026_11_12_000004_add_pass_through_to_expenses'),
    ('2026_11_12_000005_add_service_id_to_expenses'),
    ('2026_11_12_000006_create_ad_campaigns_table'),
    ('2026_11_12_000007_add_session_date_to_attendances_table'),
    ('2026_11_12_000008_add_administration_type_to_agencies'),
    ('2026_11_12_000009_add_due_date_to_invoices_table')
) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);

COMMIT;

-- ------------------------------------------------------------
-- Controles (boite SQL -> SELECT uniquement) :
-- SELECT migration FROM migrations WHERE migration >= '2026_11_12_000001' ORDER BY migration;  -- 9 lignes
-- SELECT code, phone_code FROM countries WHERE code IN ('CMR', 'CIV');                          -- +237 / +225
-- SELECT COUNT(*) FROM attendances WHERE session_date IS NULL;                                  -- historiques a dater
-- SELECT p.name FROM role_permission rp JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.name = 'caissier' AND p.name IN ('clients.supprimer');                              -- 0 ligne
-- ------------------------------------------------------------
