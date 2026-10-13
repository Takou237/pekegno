-- ============================================================
-- PEKEGNO — Permissions / rôles du lot Agency (13/10/2026).
-- À importer APRÈS migration-2026-10-13.sql, via phpPgAdmin → onglet « Importer ».
-- Rejouable sans erreur.
--
-- Contenu (équivaut à PermissionSeeder + RoleSeeder + migrations
--   2026_10_03_000011, 2026_10_08_000002, 2026_10_11_000002,
--   2026_10_13_000003, 2026_10_13_000004) :
--   1. les 16 NOUVELLES permissions Agency (packages, prestations,
--      prestation-actions, equipe-client) — absentes de
--      doc/deploy/seed-roles-permissions.sql (septembre) ;
--   2. le NOUVEAU rôle community-manager ;
--   3. les associations rôle ↔ permission EXACTEMENT comme RoleSeeder actuel ;
--   4. le rattrapage des grants caissier sur permissions pré-existantes
--      (comptabilité, catégories comptables, bilans).
-- Les permissions/rôles déjà présents sont conservés (ON CONFLICT / NOT EXISTS).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Nouvelles permissions Agency (16)
-- ------------------------------------------------------------
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0001-4000-8000-000000000001', 'packages.consulter', 'Consulter : les packages Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0002-4000-8000-000000000002', 'packages.creer', 'Créer : les packages Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0003-4000-8000-000000000003', 'packages.modifier', 'Modifier : les packages Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0004-4000-8000-000000000004', 'packages.supprimer', 'Supprimer : les packages Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0005-4000-8000-000000000005', 'prestations.consulter', 'Consulter : les prestations Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0006-4000-8000-000000000006', 'prestations.creer', 'Créer : les prestations Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0007-4000-8000-000000000007', 'prestations.modifier', 'Modifier : les prestations Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0008-4000-8000-000000000008', 'prestations.supprimer', 'Supprimer : les prestations Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0009-4000-8000-000000000009', 'prestations.valider', 'Valider : les prestations Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0010-4000-8000-000000000010', 'prestations.exporter', 'Exporter : les prestations Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0011-4000-8000-000000000011', 'prestation-actions.consulter', 'Consulter : les actions des prestations', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0012-4000-8000-000000000012', 'prestation-actions.creer', 'Créer : les actions des prestations', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0013-4000-8000-000000000013', 'prestation-actions.modifier', 'Modifier : les actions des prestations', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0014-4000-8000-000000000014', 'prestation-actions.supprimer', 'Supprimer : les actions des prestations', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0015-4000-8000-000000000015', 'equipe-client.consulter', 'Consulter : l''équipe client Agency', now(), now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES ('a1b2c3d4-0016-4000-8000-000000000016', 'equipe-client.gerer', 'Gérer : l''équipe client Agency', now(), now()) ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Nouveau rôle community-manager (idempotent, sans ON CONFLICT :
--    on ignore si la contrainte unique sur name n'existait pas)
-- ------------------------------------------------------------
INSERT INTO roles (id, name, description, created_at, updated_at)
SELECT md5('community-manager' || clock_timestamp()::text)::uuid, 'community-manager', 'Exécute les prestations Agency auxquelles il est affecté', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'community-manager');

-- ------------------------------------------------------------
-- 3. Associations rôle ↔ permission (miroir exact de RoleSeeder actuel).
--    Chaque bloc est rejouable : seules les lignes manquantes sont ajoutées.
-- ------------------------------------------------------------

-- super-admin + direction-generale : TOUT (dont les 16 nouvelles).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('super-admin', 'direction-generale')
  AND p.name IN ('packages.consulter', 'packages.creer', 'packages.modifier', 'packages.supprimer', 'prestations.consulter', 'prestations.creer', 'prestations.modifier', 'prestations.supprimer', 'prestations.valider', 'prestations.exporter', 'prestation-actions.consulter', 'prestation-actions.creer', 'prestation-actions.modifier', 'prestation-actions.supprimer', 'equipe-client.consulter', 'equipe-client.gerer')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- responsable-agence : les 16 (D9 : valide les prestations).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'responsable-agence'
  AND p.name IN ('packages.consulter', 'packages.creer', 'packages.modifier', 'packages.supprimer', 'prestations.consulter', 'prestations.creer', 'prestations.modifier', 'prestations.supprimer', 'prestations.valider', 'prestations.exporter', 'prestation-actions.consulter', 'prestation-actions.creer', 'prestation-actions.modifier', 'prestation-actions.supprimer', 'equipe-client.consulter', 'equipe-client.gerer')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- responsable-departement : 13 (sans packages.supprimer, prestations.supprimer/valider).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'responsable-departement'
  AND p.name IN ('packages.consulter', 'packages.creer', 'packages.modifier', 'prestations.consulter', 'prestations.creer', 'prestations.modifier', 'prestations.exporter', 'prestation-actions.consulter', 'prestation-actions.creer', 'prestation-actions.modifier', 'prestation-actions.supprimer', 'equipe-client.consulter', 'equipe-client.gerer')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- commercial : vend packages et prestations, ne voit que les siennes (5).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'commercial'
  AND p.name IN ('packages.consulter', 'prestations.consulter', 'prestations.creer', 'prestation-actions.consulter', 'equipe-client.consulter')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- caissier : crée + valide les prestations, exécute ses actions attribuées (6).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'caissier'
  AND p.name IN ('packages.consulter', 'prestations.consulter', 'prestations.creer', 'prestations.valider', 'prestation-actions.consulter', 'prestation-actions.modifier')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- comptable : consulte + exporte (3).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'comptable'
  AND p.name IN ('packages.consulter', 'prestations.consulter', 'prestations.exporter')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- community-manager : équipe de ses prestations uniquement (6).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'community-manager'
  AND p.name IN ('clients.consulter', 'packages.consulter', 'prestations.consulter', 'prestation-actions.consulter', 'prestation-actions.modifier', 'equipe-client.consulter')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ------------------------------------------------------------
-- 4. Rattrapage caissier sur permissions PRÉ-EXISTANTES
--    (migrations 2026_10_11_000002 + compta déjà seedée) :
--    comptabilité de son agence + catégories + bilans.
-- ------------------------------------------------------------
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'caissier'
  AND p.name IN ('comptabilite.consulter', 'comptabilite.creer', 'comptabilite.modifier', 'comptabilite.supprimer', 'comptabilite.exporter', 'accounting-categories.consulter', 'accounting-categories.creer', 'accounting-categories.modifier', 'accounting-categories.supprimer', 'bilans.consulter', 'bilans.exporter', 'commissions.encaisser')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ------------------------------------------------------------
-- 5. Contrôles rapides (à lancer après import, boîte SQL → SELECT uniquement) :
--      SELECT count(*) FROM permissions WHERE name LIKE 'packages.%' OR name LIKE 'prestations%' OR name LIKE 'prestation-actions%' OR name LIKE 'equipe-client%';  -- attendu : 16
--      SELECT r.name, count(rp.permission_id) FROM roles r LEFT JOIN role_permission rp ON rp.role_id = r.id GROUP BY r.name ORDER BY r.name;
-- ------------------------------------------------------------
