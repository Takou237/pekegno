-- ============================================================
-- PEKEGNO — Mise à jour production du 30/10/2026 (2)
--   (sessions par agence, droits clients, suppression des sessions)
-- État prod de départ : lot du 22/10/2026 appliqué (dernière migration :
--   2026_10_22_000007_renewal_number_on_commission_rules). Les lots 26/10 →
--   30/10 n'ont aucun SQL.
--
-- Contenu : les 3 migrations Laravel du 30/10, dans l'ordre :
--   A. 2026_10_30_000001_drop_training_sessions_synced_table
--      (les sessions ne sont plus synchronisées entre agences)
--   B. 2026_10_30_000002_grant_client_edit_delete_to_all_staff
--      (clients.modifier + clients.supprimer → commercial, caissier,
--       comptable, community-manager)
--   C. 2026_10_30_000003_grant_session_delete_to_department_chief
--      (sessions.supprimer → responsable-departement)
-- Aucune NOUVELLE permission : toutes existent déjà (seed de septembre).
--
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
-- Rejouable sans erreur (IF EXISTS, INSERT protégés). Une seule transaction :
-- en cas d'erreur, rien n'est modifié.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. Sessions : plus de table miroir — 2026_10_30_000001
-- ------------------------------------------------------------
DROP TABLE IF EXISTS training_sessions_synced;

-- ------------------------------------------------------------
-- B. Table Clients : modifier / supprimer pour tout le personnel — 2026_10_30_000002
-- ------------------------------------------------------------
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('commercial', 'caissier', 'comptable', 'community-manager')
  AND p.name IN ('clients.modifier', 'clients.supprimer')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ------------------------------------------------------------
-- C. Chef de département : suppression des sessions — 2026_10_30_000003
-- ------------------------------------------------------------
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'responsable-departement'
  AND p.name = 'sessions.supprimer'
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ------------------------------------------------------------
-- D. Marque les 3 migrations comme exécutées (évite tout rejeu via artisan)
-- ------------------------------------------------------------
INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES
  ('2026_10_30_000001_drop_training_sessions_synced_table'),
  ('2026_10_30_000002_grant_client_edit_delete_to_all_staff'),
  ('2026_10_30_000003_grant_session_delete_to_department_chief')
) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);

COMMIT;

-- ------------------------------------------------------------
-- Contrôles (boîte SQL → SELECT uniquement) :
-- SELECT migration FROM migrations WHERE migration LIKE '2026_10_30%' ORDER BY migration;  -- 3 lignes
-- SELECT to_regclass('public.training_sessions_synced');  -- NULL
-- SELECT r.name, p.name FROM role_permission rp JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id
--   WHERE p.name IN ('clients.modifier', 'clients.supprimer', 'sessions.supprimer') ORDER BY 2, 1;
--   -- clients.modifier / clients.supprimer : caissier, commercial, community-manager,
--   --   comptable, direction-generale, responsable-agence, responsable-departement, super-admin
--   -- sessions.supprimer : direction-generale, responsable-agence, responsable-departement, super-admin
-- ------------------------------------------------------------
