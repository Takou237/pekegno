-- ============================================================
-- PEKEGNO — Mise à jour production du 03/11/2026 (3)
--   (Community Manager = fonctionnalités du commercial en plus)
-- État prod de départ : lot du 03/11/2026 (2) appliqué.
--
-- Contenu : 1 migration Laravel :
--   A. 2026_11_03_000001_grant_commercial_permissions_to_community_manager
--      Le rôle community-manager reçoit toutes les permissions du rôle
--      commercial qu'il n'a pas encore (prospects, factures, commandes,
--      rapport commercial, entreprises, opportunités, inscriptions…).
--      Aucune permission retirée, aucun changement de schéma.
--
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
-- Rejouable sans erreur (INSERT protégé). Une seule transaction : en cas
-- d'erreur, rien n'est modifié.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. Permissions du commercial → community-manager — 2026_11_03_000001
-- ------------------------------------------------------------
INSERT INTO role_permission (role_id, permission_id)
SELECT cm.id, rp.permission_id
FROM role_permission rp
JOIN roles c  ON c.id = rp.role_id AND c.name = 'commercial'
JOIN roles cm ON cm.name = 'community-manager'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permission x
  WHERE x.role_id = cm.id AND x.permission_id = rp.permission_id
);

-- ------------------------------------------------------------
-- B. Marque la migration comme exécutée (évite tout rejeu via artisan)
-- ------------------------------------------------------------
INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES
  ('2026_11_03_000001_grant_commercial_permissions_to_community_manager')
) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);

COMMIT;

-- ------------------------------------------------------------
-- Contrôles (boîte SQL → SELECT uniquement) :
-- SELECT migration FROM migrations WHERE migration LIKE '2026_11_03%';  -- 1 ligne
-- Permissions du commercial absentes chez le community-manager (attendu : 0) :
-- SELECT COUNT(*) FROM role_permission rp
--   JOIN roles c ON c.id = rp.role_id AND c.name = 'commercial'
--   WHERE rp.permission_id NOT IN (
--     SELECT permission_id FROM role_permission x
--     JOIN roles cm ON cm.id = x.role_id AND cm.name = 'community-manager');
-- ------------------------------------------------------------
