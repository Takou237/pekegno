-- ============================================================
-- PEKEGNO — Mise à jour production du 22/10/2026
--   (commissions par rôle, validation des factures, sessions synchronisées,
--    auteur des factures)
-- État prod de départ : lot du 17/10/2026 appliqué (`17_10/`, dernière
--   migration : 2026_10_17_000001_add_amount_to_payment_proofs_table).
-- Si un lot précédent n'est pas encore passé en prod, l'appliquer D'ABORD.
--
-- Contenu : les 7 migrations Laravel du 22/10, dans l'ordre, en état final :
--   A. 2026_10_22_000001_create_training_sessions_synced_table
--   B. 2026_10_22_000002_add_created_by_to_invoices_table (+ rattrapage)
--   C. 2026_10_22_000003_restrict_invoice_validation_to_admin_and_cashier
--   D. 2026_10_22_000004_role_based_commission_rules
--   E. 2026_10_22_000005_add_target_kind_to_commission_rules
--   F. 2026_10_22_000006_grant_invoice_validation_to_director
--   G. 2026_10_22_000007_renewal_number_on_commission_rules
--   (D + G : la colonne est créée directement sous son nom final
--    `renewal_number` — même résultat que renommer `renewal_month`.)
--
-- Droits : la permission `invoices.valider` (valider / rejeter les factures
--   et les preuves de paiement) est réservée à super-admin,
--   direction-generale et caissier — retirée de tout autre rôle (C + F).
-- Les règles de commission par défaut (grille de rémunération) sont dans
--   seed-commission-rules-2026-10-22.sql, à importer JUSTE APRÈS celui-ci.
--
-- Compatible PostgreSQL 9.6 (validé sur un conteneur postgres:9.6).
-- Importer via phpPgAdmin → onglet « Importer » (jamais copier-coller dans
-- la boîte SQL, cf. README §3.2).
-- Rejouable sans erreur (IF NOT EXISTS, contraintes ajoutées seulement si
-- absentes, INSERT protégés). Une seule transaction : en cas d'erreur,
-- rien n'est modifié.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. Sessions de formation synchronisées — 2026_10_22_000001
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_sessions_synced (
    id uuid NOT NULL,
    source_session_id uuid NULL,
    training_session_id uuid NULL,
    agency_id uuid NULL,
    course_id uuid NULL,
    status character varying(20) NOT NULL DEFAULT 'planned',
    start_at timestamp(0) without time zone NULL,
    end_at timestamp(0) without time zone NULL,
    location character varying(255) NULL,
    max_capacity integer NULL,
    price numeric(14, 2) NULL,
    trainer_id character varying(36) NULL,
    module_id character varying(36) NULL,
    source_user_id character varying(255) NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL,
    deleted_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_sessions_synced_pkey') THEN ALTER TABLE training_sessions_synced ADD CONSTRAINT training_sessions_synced_pkey PRIMARY KEY (id); END IF; END $$;
CREATE INDEX IF NOT EXISTS training_sessions_synced_source_session_id_index ON training_sessions_synced (source_session_id);
CREATE INDEX IF NOT EXISTS training_sessions_synced_training_session_id_index ON training_sessions_synced (training_session_id);
CREATE INDEX IF NOT EXISTS training_sessions_synced_agency_id_index ON training_sessions_synced (agency_id);
CREATE INDEX IF NOT EXISTS training_sessions_synced_course_id_index ON training_sessions_synced (course_id);
CREATE INDEX IF NOT EXISTS training_sessions_synced_course_id_agency_id_status_index ON training_sessions_synced (course_id, agency_id, status);

-- ------------------------------------------------------------
-- B. Auteur de la facture — 2026_10_22_000002
-- ------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_created_by_foreign') THEN ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_foreign FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
-- Rattrapage des factures existantes (même règle que la migration Laravel).
UPDATE invoices
SET created_by = CASE WHEN validation_status = 'pending' AND validated_by IS NOT NULL THEN validated_by ELSE seller_user_id END
WHERE created_by IS NULL;

-- ------------------------------------------------------------
-- C + F. Validation des factures : super-admin, direction-generale, caissier
--   — 2026_10_22_000003 puis 2026_10_22_000006
-- ------------------------------------------------------------
DELETE FROM role_permission
WHERE permission_id IN (SELECT id FROM permissions WHERE name = 'invoices.valider')
  AND role_id NOT IN (SELECT id FROM roles WHERE name IN ('super-admin', 'direction-generale', 'caissier'));

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('super-admin', 'direction-generale', 'caissier')
  AND p.name = 'invoices.valider'
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ------------------------------------------------------------
-- D + E + G. Règles de commission par rôle — 2026_10_22_000004/5/7
-- ------------------------------------------------------------
-- Paramètres d'une règle (assiette, cible, renouvellement, paliers, primes).
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS basis character varying(30) NOT NULL DEFAULT 'sale';
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS target_kind character varying(20) NULL;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS description text NULL;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS product_id uuid NULL;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS category_id uuid NULL;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS renewal_number smallint NULL;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS renewal_on_time boolean NOT NULL DEFAULT false;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS revenue_scope character varying(20) NOT NULL DEFAULT 'own';
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS min_recovery_rate numeric(5, 2) NULL;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS recovery_period character varying(30) NOT NULL DEFAULT 'previous_month';
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS growth_multiplier numeric(6, 2) NULL;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS max_percent numeric(5, 2) NULL;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS bonus_min numeric(14, 2) NULL;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS bonus_max numeric(14, 2) NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_rules_product_id_foreign') THEN ALTER TABLE commission_rules ADD CONSTRAINT commission_rules_product_id_foreign FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_rules_category_id_foreign') THEN ALTER TABLE commission_rules ADD CONSTRAINT commission_rules_category_id_foreign FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL; END IF; END $$;

-- Attribution règle ↔ rôle, par groupe de règle (survit aux nouvelles versions).
CREATE TABLE IF NOT EXISTS commission_rule_role (
    rule_group_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_rule_role_pkey') THEN ALTER TABLE commission_rule_role ADD CONSTRAINT commission_rule_role_pkey PRIMARY KEY (rule_group_id, role_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_rule_role_role_id_foreign') THEN ALTER TABLE commission_rule_role ADD CONSTRAINT commission_rule_role_role_id_foreign FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE; END IF; END $$;
CREATE INDEX IF NOT EXISTS commission_rule_role_role_id_index ON commission_rule_role (role_id);

-- Bénéficiaire « utilisateur » (chef, community manager…) et mois des primes périodiques.
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS beneficiary_user_id uuid NULL;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS period character varying(7) NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_entries_beneficiary_user_id_foreign') THEN ALTER TABLE commission_entries ADD CONSTRAINT commission_entries_beneficiary_user_id_foreign FOREIGN KEY (beneficiary_user_id) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
-- Nom tronqué à 63 caractères par PostgreSQL (identique à la base créée par Laravel).
CREATE INDEX IF NOT EXISTS commission_entries_commission_rule_id_beneficiary_user_id_perio ON commission_entries (commission_rule_id, beneficiary_user_id, period);

ALTER TABLE commission_payments ADD COLUMN IF NOT EXISTS beneficiary_user_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_payments_beneficiary_user_id_foreign') THEN ALTER TABLE commission_payments ADD CONSTRAINT commission_payments_beneficiary_user_id_foreign FOREIGN KEY (beneficiary_user_id) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;

-- ------------------------------------------------------------
-- H. Marque les 7 migrations comme exécutées (évite tout rejeu via artisan)
-- ------------------------------------------------------------
INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES
  ('2026_10_22_000001_create_training_sessions_synced_table'),
  ('2026_10_22_000002_add_created_by_to_invoices_table'),
  ('2026_10_22_000003_restrict_invoice_validation_to_admin_and_cashier'),
  ('2026_10_22_000004_role_based_commission_rules'),
  ('2026_10_22_000005_add_target_kind_to_commission_rules'),
  ('2026_10_22_000006_grant_invoice_validation_to_director'),
  ('2026_10_22_000007_renewal_number_on_commission_rules')
) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);

COMMIT;

-- ------------------------------------------------------------
-- Contrôles (boîte SQL → SELECT uniquement) :
-- SELECT migration FROM migrations WHERE migration LIKE '2026_10_22%' ORDER BY migration;  -- 7 lignes
-- SELECT to_regclass('public.training_sessions_synced'), to_regclass('public.commission_rule_role');  -- 2 non NULL
-- SELECT r.name FROM role_permission rp JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id WHERE p.name = 'invoices.valider' ORDER BY 1;
--   -- attendu : caissier, direction-generale, super-admin (et rien d'autre)
-- SELECT count(*) FROM invoices WHERE created_by IS NULL;  -- 0 (ou factures sans vendeur)
-- ------------------------------------------------------------
