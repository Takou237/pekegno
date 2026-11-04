-- ============================================================
-- PEKEGNO — Mise à jour production du 04/11/2026 (2)
--   (inscription effective à la validation de la facture, nettoyage des
--    clients créés pour une vente annulée, espace formateur)
-- État prod de départ : lot du 04/11/2026 (`04_11/`) appliqué
--   (dernière migration en prod : 2026_11_03_000001).
--
-- Contenu : 3 migrations Laravel (schéma seul, aucune permission) :
--   A. 2026_11_03_000002_add_soft_deletes_to_users_table
--      users.deleted_at : suppression logique du client créé pour une
--      inscription / souscription dont la facture est annulée ou rejetée.
--      ⚠ Le code du lot l'utilise sur TOUTES les requêtes users (connexion
--      comprise) : à importer juste après le `git pull`.
--   B. 2026_11_03_000003_add_client_was_created_to_invoices_table
--      invoices.client_was_created : le client a été créé pendant la vente.
--   C. 2026_11_04_000001_add_requested_session_id_to_formation_enrollments_table
--      formation_enrollments.requested_session_id : session choisie pour une
--      inscription « en attente de validation » (attribuée à la validation).
--
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
-- Rejouable sans erreur (IF NOT EXISTS / contraintes protégées). Une seule
-- transaction : en cas d'erreur, rien n'est modifié.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. Suppression logique des utilisateurs — 2026_11_03_000002
-- ------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamp(0) without time zone NULL;

-- ------------------------------------------------------------
-- B. Client créé pendant la vente — 2026_11_03_000003
-- ------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_was_created boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- C. Session demandée d'une inscription en attente — 2026_11_04_000001
-- ------------------------------------------------------------
ALTER TABLE formation_enrollments ADD COLUMN IF NOT EXISTS requested_session_id uuid NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'formation_enrollments_requested_session_id_foreign') THEN ALTER TABLE formation_enrollments ADD CONSTRAINT formation_enrollments_requested_session_id_foreign FOREIGN KEY (requested_session_id) REFERENCES training_sessions(id) ON DELETE SET NULL; END IF; END $$;

-- ------------------------------------------------------------
-- D. Marque les migrations comme exécutées (évite tout rejeu via artisan)
-- ------------------------------------------------------------
INSERT INTO migrations (migration, batch)
SELECT v.m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES
  ('2026_11_03_000002_add_soft_deletes_to_users_table'),
  ('2026_11_03_000003_add_client_was_created_to_invoices_table'),
  ('2026_11_04_000001_add_requested_session_id_to_formation_enrollments_table')
) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);

COMMIT;

-- ------------------------------------------------------------
-- Contrôles (boîte SQL → SELECT uniquement) :
-- SELECT migration FROM migrations WHERE migration > '2026_11_03_000001' ORDER BY migration;  -- 3 lignes
-- SELECT column_name, table_name FROM information_schema.columns
--   WHERE (table_name, column_name) IN (('users','deleted_at'), ('invoices','client_was_created'),
--                                       ('formation_enrollments','requested_session_id'));  -- 3 lignes
-- Inscriptions saisies AVANT ce lot dont la facture attend encore validation
-- (elles restent « Inscrit », ancien comportement — information seulement) :
-- SELECT COUNT(*) FROM formation_enrollments fe JOIN invoices i ON i.id = fe.invoice_id
--   WHERE i.validation_status = 'pending' AND i.cancelled_at IS NULL AND fe.status = 'enrolled';
-- ------------------------------------------------------------
