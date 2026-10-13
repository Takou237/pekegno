-- ============================================================
-- PEKEGNO — Mise à jour production du 13/10/2026 (lot Agency + suivi)
-- État prod de départ : migrations Laravel jusqu'à
--   2026_09_30_000003_add_payer_phone_to_invoices_table
-- (voir doc/deploy/README.md §1). repair-converted-clients-2026-10-01.sql
-- est indépendant (données seules) : l'appliquer séparément s'il ne l'est pas.
--
-- Contenu : TOUTES les migrations locales post-30/09, dans l'ordre :
--   2026_10_03_000001 → 2026_10_13_000004 (28 migrations, liste en fin de fichier)
--   - nouvelles tables Agency (catégories, rôles équipe, packages, prestations,
--     actions + commentaires/logs/revues, notifications, exécutions, offres,
--     annuaire équipiers) ;
--   - extensions (subscription_packs, promotions, contracts, invoices,
--     invoice_items, commission_rules/entries/payments, accounting_transactions,
--     prestations, users, services) ;
--   - données : settings commission 20 % par défaut, is_public des packs → true,
--     rattrapage department_id des écritures comptables.
--   Les GRANTS de permissions sont dans seed-permissions-2026-10-13.sql
--   (à importer juste après celui-ci).
--
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
-- Rejouable sans erreur (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- contraintes/FK/index ajoutés seulement s'ils manquent, UPDATE idempotents).
-- ============================================================

-- ------------------------------------------------------------
-- A. Catégories Agency (D2) — 2026_10_03_000001
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agency_categories (
    id uuid NOT NULL,
    department_id uuid NULL,
    kind character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    description text NULL,
    color character varying(20) NULL,
    icon character varying(50) NULL,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL,
    deleted_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_categories_pkey') THEN ALTER TABLE agency_categories ADD CONSTRAINT agency_categories_pkey PRIMARY KEY (id); END IF; END $$;
CREATE INDEX IF NOT EXISTS agency_categories_department_id_kind_index ON agency_categories (department_id, kind);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_categories_department_id_foreign') THEN ALTER TABLE agency_categories ADD CONSTRAINT agency_categories_department_id_foreign FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; END IF; END $$;

-- ------------------------------------------------------------
-- B. Rôles métier équipe client (aucune permission applicative) — 2026_10_03_000002
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_team_roles (
    id uuid NOT NULL,
    department_id uuid NULL,
    name character varying(255) NOT NULL,
    description text NULL,
    color character varying(20) NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL,
    deleted_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_team_roles_pkey') THEN ALTER TABLE client_team_roles ADD CONSTRAINT client_team_roles_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_team_roles_department_id_foreign') THEN ALTER TABLE client_team_roles ADD CONSTRAINT client_team_roles_department_id_foreign FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; END IF; END $$;

-- ------------------------------------------------------------
-- C. Packages = packs d'abonnement enrichis — 2026_10_03_000003
-- ------------------------------------------------------------
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS code VARCHAR(30) NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_packs_code_unique') THEN ALTER TABLE subscription_packs ADD CONSTRAINT subscription_packs_code_unique UNIQUE (code); END IF; END $$;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS department_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_packs_department_id_foreign') THEN ALTER TABLE subscription_packs ADD CONSTRAINT subscription_packs_department_id_foreign FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS category_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_packs_category_id_foreign') THEN ALTER TABLE subscription_packs ADD CONSTRAINT subscription_packs_category_id_foreign FOREIGN KEY (category_id) REFERENCES agency_categories(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS tagline VARCHAR(255) NULL;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS prerequisites TEXT NULL;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS original_price NUMERIC(15, 2) NULL;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS price_is_starting_from BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly';
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS min_duration_months INTEGER NULL;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscription_packs ADD COLUMN IF NOT EXISTS cover_image VARCHAR(255) NULL;

-- ------------------------------------------------------------
-- D. Contenu des packages + recommandations — 2026_10_03_000004
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS package_items (
    id uuid NOT NULL,
    package_id uuid NOT NULL,
    service_id uuid NULL,
    label character varying(255) NOT NULL,
    quantity integer NULL,
    frequency character varying(20) NULL,
    unit character varying(50) NULL,
    action_type character varying(30) NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_items_pkey') THEN ALTER TABLE package_items ADD CONSTRAINT package_items_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_items_package_id_foreign') THEN ALTER TABLE package_items ADD CONSTRAINT package_items_package_id_foreign FOREIGN KEY (package_id) REFERENCES subscription_packs(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_items_service_id_foreign') THEN ALTER TABLE package_items ADD CONSTRAINT package_items_service_id_foreign FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL; END IF; END $$;

CREATE TABLE IF NOT EXISTS package_recommendations (
    id uuid NOT NULL,
    package_id uuid NOT NULL,
    client_team_role_id uuid NULL,
    label character varying(255) NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_recommendations_pkey') THEN ALTER TABLE package_recommendations ADD CONSTRAINT package_recommendations_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_recommendations_package_id_foreign') THEN ALTER TABLE package_recommendations ADD CONSTRAINT package_recommendations_package_id_foreign FOREIGN KEY (package_id) REFERENCES subscription_packs(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_recommendations_client_team_role_id_foreign') THEN ALTER TABLE package_recommendations ADD CONSTRAINT package_recommendations_client_team_role_id_foreign FOREIGN KEY (client_team_role_id) REFERENCES client_team_roles(id) ON DELETE SET NULL; END IF; END $$;

-- ------------------------------------------------------------
-- E. Promotions liées aux packages — 2026_10_03_000005
-- ------------------------------------------------------------
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS package_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_package_id_foreign') THEN ALTER TABLE promotions ADD CONSTRAINT promotions_package_id_foreign FOREIGN KEY (package_id) REFERENCES subscription_packs(id) ON DELETE CASCADE; END IF; END $$;

-- ------------------------------------------------------------
-- F. Prestations + équipiers (forme initiale : user_id NOT NULL,
--    rendu nullable + team_member_id en section N) — 2026_10_03_000006
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestations (
    id uuid NOT NULL,
    reference character varying(30) NOT NULL,
    agency_id uuid NOT NULL,
    department_id uuid NULL,
    category_id uuid NULL,
    name character varying(255) NOT NULL,
    description text NULL,
    client_id uuid NOT NULL,
    company_id uuid NULL,
    commercial_id uuid NULL,
    package_id uuid NULL,
    contract_id uuid NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    budget numeric(15, 2) NOT NULL DEFAULT 0,
    commission_type character varying(10) NULL,
    commission_value numeric(12, 2) NULL,
    status character varying(30) NOT NULL DEFAULT 'draft',
    status_reason text NULL,
    rating_avg numeric(3, 1) NULL,
    rating_count integer NOT NULL DEFAULT 0,
    validated_by uuid NULL,
    validated_at timestamp(0) without time zone NULL,
    created_by uuid NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL,
    deleted_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_pkey') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_reference_unique') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_reference_unique UNIQUE (reference); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_agency_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_department_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_department_id_foreign FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_category_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_category_id_foreign FOREIGN KEY (category_id) REFERENCES agency_categories(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_client_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_client_id_foreign FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_company_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_company_id_foreign FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_commercial_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES commercials(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_package_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_package_id_foreign FOREIGN KEY (package_id) REFERENCES subscription_packs(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_contract_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_contract_id_foreign FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_validated_by_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_validated_by_foreign FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_created_by_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_created_by_foreign FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
CREATE INDEX IF NOT EXISTS prestations_agency_id_status_index ON prestations (agency_id, status);
CREATE INDEX IF NOT EXISTS prestations_client_id_index ON prestations (client_id);

CREATE TABLE IF NOT EXISTS prestation_team_members (
    id uuid NOT NULL,
    prestation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_team_role_id uuid NULL,
    is_lead boolean NOT NULL DEFAULT false,
    start_date date NULL,
    end_date date NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_team_members_pkey') THEN ALTER TABLE prestation_team_members ADD CONSTRAINT prestation_team_members_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_team_members_prestation_id_foreign') THEN ALTER TABLE prestation_team_members ADD CONSTRAINT prestation_team_members_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES prestations(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_team_members_user_id_foreign') THEN ALTER TABLE prestation_team_members ADD CONSTRAINT prestation_team_members_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_team_members_client_team_role_id_foreign') THEN ALTER TABLE prestation_team_members ADD CONSTRAINT prestation_team_members_client_team_role_id_foreign FOREIGN KEY (client_team_role_id) REFERENCES client_team_roles(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_prestation_team_member') THEN ALTER TABLE prestation_team_members ADD CONSTRAINT uq_prestation_team_member UNIQUE (prestation_id, user_id, client_team_role_id); END IF; END $$;

-- ------------------------------------------------------------
-- G. Actions des prestations + commentaires + journal + notes client — 2026_10_03_000007
--    (journal créé d'emblée avec proof_file — 2026_10_13_000002)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestation_actions (
    id uuid NOT NULL,
    prestation_id uuid NOT NULL,
    package_item_id uuid NULL,
    type character varying(30) NOT NULL DEFAULT 'other',
    title character varying(255) NOT NULL,
    description text NULL,
    platform character varying(50) NULL,
    quantity integer NOT NULL DEFAULT 1,
    frequency character varying(20) NOT NULL DEFAULT 'once',
    unit character varying(50) NULL,
    budget numeric(15, 2) NOT NULL DEFAULT 0,
    actual_cost numeric(15, 2) NULL,
    is_pass_through boolean NOT NULL DEFAULT false,
    assigned_to uuid NULL,
    start_date date NULL,
    due_date date NULL,
    status character varying(20) NOT NULL DEFAULT 'todo',
    comment text NULL,
    rating smallint NULL,
    sort_order integer NOT NULL DEFAULT 0,
    overdue_notified_at timestamp(0) without time zone NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL,
    deleted_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_actions_pkey') THEN ALTER TABLE prestation_actions ADD CONSTRAINT prestation_actions_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_actions_prestation_id_foreign') THEN ALTER TABLE prestation_actions ADD CONSTRAINT prestation_actions_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES prestations(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_actions_package_item_id_foreign') THEN ALTER TABLE prestation_actions ADD CONSTRAINT prestation_actions_package_item_id_foreign FOREIGN KEY (package_item_id) REFERENCES package_items(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_actions_assigned_to_foreign') THEN ALTER TABLE prestation_actions ADD CONSTRAINT prestation_actions_assigned_to_foreign FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
CREATE INDEX IF NOT EXISTS prestation_actions_prestation_id_status_index ON prestation_actions (prestation_id, status);

CREATE TABLE IF NOT EXISTS prestation_action_comments (
    id uuid NOT NULL,
    prestation_action_id uuid NOT NULL,
    user_id uuid NULL,
    body text NOT NULL,
    attachment_path character varying(255) NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_comments_pkey') THEN ALTER TABLE prestation_action_comments ADD CONSTRAINT prestation_action_comments_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_comments_prestation_action_id_foreign') THEN ALTER TABLE prestation_action_comments ADD CONSTRAINT prestation_action_comments_prestation_action_id_foreign FOREIGN KEY (prestation_action_id) REFERENCES prestation_actions(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_comments_user_id_foreign') THEN ALTER TABLE prestation_action_comments ADD CONSTRAINT prestation_action_comments_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;

CREATE TABLE IF NOT EXISTS prestation_action_logs (
    id uuid NOT NULL,
    prestation_action_id uuid NOT NULL,
    user_id uuid NULL,
    done_at timestamp(0) without time zone NOT NULL,
    quantity_done integer NOT NULL DEFAULT 1,
    proof_url character varying(255) NULL,
    proof_file character varying(2048) NULL,
    cost numeric(15, 2) NULL,
    note text NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_logs_pkey') THEN ALTER TABLE prestation_action_logs ADD CONSTRAINT prestation_action_logs_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_logs_prestation_action_id_foreign') THEN ALTER TABLE prestation_action_logs ADD CONSTRAINT prestation_action_logs_prestation_action_id_foreign FOREIGN KEY (prestation_action_id) REFERENCES prestation_actions(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_logs_user_id_foreign') THEN ALTER TABLE prestation_action_logs ADD CONSTRAINT prestation_action_logs_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
-- Sécurité rejouabilité (cas d'un import partiel antérieur) — 2026_10_13_000002 :
ALTER TABLE prestation_action_logs ADD COLUMN IF NOT EXISTS proof_file VARCHAR(2048) NULL;

CREATE TABLE IF NOT EXISTS prestation_action_reviews (
    id uuid NOT NULL,
    prestation_action_id uuid NOT NULL,
    prestation_id uuid NOT NULL,
    client_user_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_reviews_pkey') THEN ALTER TABLE prestation_action_reviews ADD CONSTRAINT prestation_action_reviews_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_reviews_prestation_action_id_foreign') THEN ALTER TABLE prestation_action_reviews ADD CONSTRAINT prestation_action_reviews_prestation_action_id_foreign FOREIGN KEY (prestation_action_id) REFERENCES prestation_actions(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_reviews_prestation_id_foreign') THEN ALTER TABLE prestation_action_reviews ADD CONSTRAINT prestation_action_reviews_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES prestations(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_reviews_client_user_id_foreign') THEN ALTER TABLE prestation_action_reviews ADD CONSTRAINT prestation_action_reviews_client_user_id_foreign FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_action_review_client') THEN ALTER TABLE prestation_action_reviews ADD CONSTRAINT uq_action_review_client UNIQUE (prestation_action_id, client_user_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS prestation_action_reviews_prestation_id_index ON prestation_action_reviews (prestation_id);

-- ------------------------------------------------------------
-- H. Contrats enrichis Agency — 2026_10_03_000008
-- ------------------------------------------------------------
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS origin VARCHAR(20) NOT NULL DEFAULT 'manual';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS prestation_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_prestation_id_foreign') THEN ALTER TABLE contracts ADD CONSTRAINT contracts_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES prestations(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS commercial_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_commercial_id_foreign') THEN ALTER TABLE contracts ADD CONSTRAINT contracts_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES commercials(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS budget_allocated NUMERIC(15, 2) NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP(0) WITHOUT TIME ZONE NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP(0) WITHOUT TIME ZONE NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_document_path VARCHAR(255) NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS suspended_reason TEXT NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS legacy_subscription_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_legacy_subscription_id_foreign') THEN ALTER TABLE contracts ADD CONSTRAINT contracts_legacy_subscription_id_foreign FOREIGN KEY (legacy_subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_legacy_subscription_id_unique') THEN ALTER TABLE contracts ADD CONSTRAINT contracts_legacy_subscription_id_unique UNIQUE (legacy_subscription_id); END IF; END $$;

-- ------------------------------------------------------------
-- I. Liens factures / lignes / règles de commission — 2026_10_03_000009
-- ------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_contract_id_foreign') THEN ALTER TABLE invoices ADD CONSTRAINT invoices_contract_id_foreign FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS package_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_package_id_foreign') THEN ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_package_id_foreign FOREIGN KEY (package_id) REFERENCES subscription_packs(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS prestation_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_prestation_id_foreign') THEN ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES prestations(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS is_pass_through BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS package_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_rules_package_id_foreign') THEN ALTER TABLE commission_rules ADD CONSTRAINT commission_rules_package_id_foreign FOREIGN KEY (package_id) REFERENCES subscription_packs(id) ON DELETE SET NULL; END IF; END $$;

-- ------------------------------------------------------------
-- J. Notifications in-app Agency — 2026_10_03_000010
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agency_notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    body text NULL,
    entity_type character varying(50) NULL,
    entity_id uuid NULL,
    data json NULL,
    dedupe_key character varying(255) NULL,
    read_at timestamp(0) without time zone NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_notifications_pkey') THEN ALTER TABLE agency_notifications ADD CONSTRAINT agency_notifications_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_notifications_user_id_foreign') THEN ALTER TABLE agency_notifications ADD CONSTRAINT agency_notifications_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_agency_notification_dedupe') THEN ALTER TABLE agency_notifications ADD CONSTRAINT uq_agency_notification_dedupe UNIQUE (user_id, dedupe_key); END IF; END $$;
CREATE INDEX IF NOT EXISTS agency_notifications_user_id_read_at_index ON agency_notifications (user_id, read_at);

-- ------------------------------------------------------------
-- K. Comptabilité rattachée au département + rattrapage existant — 2026_10_03_000012
-- ------------------------------------------------------------
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS department_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_transactions_department_id_foreign') THEN ALTER TABLE accounting_transactions ADD CONSTRAINT accounting_transactions_department_id_foreign FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; END IF; END $$;
CREATE INDEX IF NOT EXISTS accounting_transactions_department_id_transacted_at_index ON accounting_transactions (department_id, transacted_at);
-- Rattrapage : écritures issues de factures liées à un contrat avec département.
UPDATE accounting_transactions at
SET department_id = c.department_id
FROM invoices i JOIN contracts c ON c.id = i.contract_id
WHERE at.invoice_id = i.id AND at.department_id IS NULL AND c.department_id IS NOT NULL;
-- Rattrapage : écritures issues de factures d'inscription (département academy de l'agence).
UPDATE accounting_transactions at
SET department_id = (
  SELECT d.id FROM departments d
  WHERE d.agency_id = i.agency_id AND d.type = 'academy'
  ORDER BY d.created_at LIMIT 1
)
FROM invoices i
WHERE at.invoice_id = i.id AND at.department_id IS NULL AND i.agency_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM formation_enrollments fe WHERE fe.invoice_id = i.id);
-- Rattrapage : dépenses (référence = numéro de dépense).
UPDATE accounting_transactions at
SET department_id = e.department_id
FROM expenses e
WHERE at.type = 'expense' AND at.department_id IS NULL AND at.reference = e.number AND e.department_id IS NOT NULL;

-- ------------------------------------------------------------
-- L. Exécutions concrètes des actions (avec proof_file) — 2026_10_08_000001 + 2026_10_13_000002
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestation_action_executions (
    id uuid NOT NULL,
    prestation_action_id uuid NOT NULL,
    week_number integer NOT NULL DEFAULT 1,
    week_start_date date NULL,
    week_end_date date NULL,
    occurrence_number integer NOT NULL DEFAULT 1,
    title character varying(255) NULL,
    status character varying(20) NOT NULL DEFAULT 'todo',
    scheduled_date date NULL,
    done_at timestamp(0) without time zone NULL,
    proof_url character varying(2048) NULL,
    proof_file character varying(2048) NULL,
    actual_cost numeric(15, 2) NULL,
    note text NULL,
    is_manual boolean NOT NULL DEFAULT false,
    user_id uuid NULL,
    assigned_to uuid NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_executions_pkey') THEN ALTER TABLE prestation_action_executions ADD CONSTRAINT prestation_action_executions_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_executions_prestation_action_id_foreign') THEN ALTER TABLE prestation_action_executions ADD CONSTRAINT prestation_action_executions_prestation_action_id_foreign FOREIGN KEY (prestation_action_id) REFERENCES prestation_actions(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_executions_user_id_foreign') THEN ALTER TABLE prestation_action_executions ADD CONSTRAINT prestation_action_executions_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_action_executions_assigned_to_foreign') THEN ALTER TABLE prestation_action_executions ADD CONSTRAINT prestation_action_executions_assigned_to_foreign FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_pa_exec_week ON prestation_action_executions (prestation_action_id, week_number);
CREATE INDEX IF NOT EXISTS idx_pa_exec_status ON prestation_action_executions (prestation_action_id, status);
-- Sécurité rejouabilité (import partiel antérieur) :
ALTER TABLE prestation_action_executions ADD COLUMN IF NOT EXISTS proof_file VARCHAR(2048) NULL;

-- ------------------------------------------------------------
-- M. Offres de prestation (fiches catalogue) — 2026_10_08_000002
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestation_offers (
    id uuid NOT NULL,
    agency_id uuid NOT NULL,
    department_id uuid NULL,
    category_id uuid NULL,
    name character varying(255) NOT NULL,
    description text NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NULL,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL,
    deleted_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_offers_pkey') THEN ALTER TABLE prestation_offers ADD CONSTRAINT prestation_offers_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_offers_agency_id_foreign') THEN ALTER TABLE prestation_offers ADD CONSTRAINT prestation_offers_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_offers_department_id_foreign') THEN ALTER TABLE prestation_offers ADD CONSTRAINT prestation_offers_department_id_foreign FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_offers_category_id_foreign') THEN ALTER TABLE prestation_offers ADD CONSTRAINT prestation_offers_category_id_foreign FOREIGN KEY (category_id) REFERENCES agency_categories(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_offers_created_by_foreign') THEN ALTER TABLE prestation_offers ADD CONSTRAINT prestation_offers_created_by_foreign FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
CREATE INDEX IF NOT EXISTS prestation_offers_agency_id_department_id_index ON prestation_offers (agency_id, department_id);

-- ------------------------------------------------------------
-- N. Prestations : offre + preuve de paiement + note directe — 2026_10_08_000003 (x2) + 000004
-- ------------------------------------------------------------
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS offer_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_offer_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_offer_id_foreign FOREIGN KEY (offer_id) REFERENCES prestation_offers(id) ON DELETE SET NULL; END IF; END $$;
CREATE INDEX IF NOT EXISTS prestations_offer_id_index ON prestations (offer_id);
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS declared_advance_amount NUMERIC(15, 2) NULL;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS declared_total_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS payment_proof_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_payment_proof_id_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_payment_proof_id_foreign FOREIGN KEY (payment_proof_id) REFERENCES payment_proofs(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS submitted_with_proof_at TIMESTAMP(0) WITHOUT TIME ZONE NULL;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS client_direct_rating SMALLINT NULL;
CREATE INDEX IF NOT EXISTS prestations_client_direct_rating_index ON prestations (client_direct_rating);
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS client_direct_comment TEXT NULL;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS client_direct_rated_at TIMESTAMP(0) WITHOUT TIME ZONE NULL;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS client_direct_rated_by uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestations_client_direct_rated_by_foreign') THEN ALTER TABLE prestations ADD CONSTRAINT prestations_client_direct_rated_by_foreign FOREIGN KEY (client_direct_rated_by) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;

-- ------------------------------------------------------------
-- O. Packages publics par défaut + bascule existant — 2026_10_08_000005
-- ------------------------------------------------------------
ALTER TABLE subscription_packs ALTER COLUMN is_public SET DEFAULT true;
UPDATE subscription_packs SET is_public = true WHERE is_public IS NOT TRUE;

-- ------------------------------------------------------------
-- P. Annuaire des équipiers — 2026_10_09_000001
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id uuid NOT NULL,
    agency_id uuid NULL,
    department_id uuid NULL,
    first_name character varying(150) NOT NULL,
    last_name character varying(150) NOT NULL,
    email character varying(255) NULL,
    phone character varying(50) NULL,
    user_id uuid NULL,
    commission_type character varying(20) NOT NULL DEFAULT 'none',
    commission_value numeric(12, 2) NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp(0) without time zone NULL,
    updated_at timestamp(0) without time zone NULL,
    deleted_at timestamp(0) without time zone NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_pkey') THEN ALTER TABLE team_members ADD CONSTRAINT team_members_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_agency_id_foreign') THEN ALTER TABLE team_members ADD CONSTRAINT team_members_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_department_id_foreign') THEN ALTER TABLE team_members ADD CONSTRAINT team_members_department_id_foreign FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_foreign') THEN ALTER TABLE team_members ADD CONSTRAINT team_members_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_unique') THEN ALTER TABLE team_members ADD CONSTRAINT team_members_user_id_unique UNIQUE (user_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS team_members_agency_id_is_active_index ON team_members (agency_id, is_active);
CREATE INDEX IF NOT EXISTS team_members_department_id_is_active_index ON team_members (department_id, is_active);

-- ------------------------------------------------------------
-- Q. Équipiers sans compte + leurs commissions — 2026_10_09_000002
-- ------------------------------------------------------------
ALTER TABLE prestation_team_members ADD COLUMN IF NOT EXISTS team_member_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prestation_team_members_team_member_id_foreign') THEN ALTER TABLE prestation_team_members ADD CONSTRAINT prestation_team_members_team_member_id_foreign FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE prestation_team_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS beneficiary_team_member_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_entries_beneficiary_team_member_id_foreign') THEN ALTER TABLE commission_entries ADD CONSTRAINT commission_entries_beneficiary_team_member_id_foreign FOREIGN KEY (beneficiary_team_member_id) REFERENCES team_members(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE commission_payments ADD COLUMN IF NOT EXISTS beneficiary_team_member_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_payments_beneficiary_team_member_id_foreign') THEN ALTER TABLE commission_payments ADD CONSTRAINT commission_payments_beneficiary_team_member_id_foreign FOREIGN KEY (beneficiary_team_member_id) REFERENCES team_members(id) ON DELETE SET NULL; END IF; END $$;

-- ------------------------------------------------------------
-- R. Fiche client enrichie — 2026_10_12_000001
-- ------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quartier VARCHAR(150) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation VARCHAR(150) NULL;

-- ------------------------------------------------------------
-- S. Commission propre au service — 2026_10_13_000001
-- ------------------------------------------------------------
ALTER TABLE services ADD COLUMN IF NOT EXISTS commission_type VARCHAR(10) NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS commission_value NUMERIC(12, 2) NULL;

-- ------------------------------------------------------------
-- T. Réglages : commission 20 % par défaut — 2026_10_11_000001
-- ------------------------------------------------------------
INSERT INTO settings (id, key, value, description, created_at, updated_at)
SELECT md5(random()::text || clock_timestamp()::text)::uuid, 'default_commission_type', '"percent"',
       'Type de commission par défaut (none, percent, fixed)', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'default_commission_type');
-- Si la clé existe déjà avec une autre valeur (ancien seed), on l'aligne sur 20 % :
UPDATE settings SET value = '"percent"', updated_at = now() WHERE key = 'default_commission_type' AND value::text IS DISTINCT FROM '"percent"';
INSERT INTO settings (id, key, value, description, created_at, updated_at)
SELECT md5(random()::text || clock_timestamp()::text)::uuid, 'default_commission_value', '20',
       'Valeur de commission par défaut', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'default_commission_value');
UPDATE settings SET value = '20', updated_at = now() WHERE key = 'default_commission_value' AND value::text IS DISTINCT FROM '20';

-- ------------------------------------------------------------
-- U. Marque les 28 migrations comme exécutées (évite tout rejeu via artisan)
-- ------------------------------------------------------------
INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES
  ('2026_10_03_000001_create_agency_categories_table'),
  ('2026_10_03_000002_create_client_team_roles_table'),
  ('2026_10_03_000003_extend_subscription_packs_for_agency_packages'),
  ('2026_10_03_000004_create_package_items_and_recommendations_tables'),
  ('2026_10_03_000005_add_package_id_to_promotions_table'),
  ('2026_10_03_000006_create_prestations_table'),
  ('2026_10_03_000007_create_prestation_actions_tables'),
  ('2026_10_03_000008_extend_contracts_for_agency'),
  ('2026_10_03_000009_add_agency_links_to_invoices_and_commissions'),
  ('2026_10_03_000010_create_agency_notifications_table'),
  ('2026_10_03_000011_grant_agency_permissions'),
  ('2026_10_03_000012_add_department_id_to_accounting_transactions'),
  ('2026_10_08_000001_create_prestation_action_executions_table'),
  ('2026_10_08_000002_create_prestation_offers_table'),
  ('2026_10_08_000002_grant_cashier_agency'),
  ('2026_10_08_000003_add_offer_id_to_prestations_table'),
  ('2026_10_08_000003_add_payment_proof_fields_to_prestations_table'),
  ('2026_10_08_000004_add_direct_rating_to_prestations_table'),
  ('2026_10_08_000005_packages_public_by_default'),
  ('2026_10_09_000001_create_team_members_table'),
  ('2026_10_09_000002_team_member_affectation_and_commissions'),
  ('2026_10_11_000001_default_commission_20_percent'),
  ('2026_10_11_000002_cashier_accounting_permissions'),
  ('2026_10_12_000001_add_client_profile_details_to_users'),
  ('2026_10_13_000001_add_commission_to_services_table'),
  ('2026_10_13_000002_add_proof_file_to_executions_table'),
  ('2026_10_13_000003_grant_cashier_action_execution'),
  ('2026_10_13_000004_grant_commercial_prestation_create')
) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);
