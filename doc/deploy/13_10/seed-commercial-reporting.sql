-- ============================================================
-- PEKEGNO — Droit commercial : suivi des ventes + rapport mensuel (13/10/2026).
-- À importer via phpPgAdmin → onglet « Importer » (jamais copier-coller
-- dans la boîte SQL, cf. doc/deploy/README.md §3.2). Rejouable sans erreur.
--
-- Problème : connecté en commercial, les pages
--   /sales-tracking  (GET /api/sales-tracking)
--   /commercials/monthly-report  (GET /api/commercials/report/detail)
-- répondent 403 → toast « Vous n'avez pas les droits nécessaires pour
-- cette action ». Les deux routes exigent la permission
-- `commercials.reporting`, présente en local (RoleSeeder) mais ABSENTE en
-- production (seed de septembre : le commercial n'a que
-- `commercials.consulter`, pas `reporting`).
-- Ce script ajoute le(s) droit(s) manquant(s), sans toucher au reste.
-- ============================================================

-- Reporting commercial (suivi des ventes + rapport + rapport mensuel + export).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'commercial'
  AND p.name IN ('commercials.reporting')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Sécurité : consultation des commerciaux (autocomplétion des deux pages).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'commercial'
  AND p.name IN ('commercials.consulter')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ------------------------------------------------------------
-- Contrôle rapide (boîte SQL → SELECT uniquement) :
--   SELECT p.name FROM roles r
--   JOIN role_permission rp ON rp.role_id = r.id
--   JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.name = 'commercial' AND p.name LIKE 'commercials.%';
-- Attendu : commercials.consulter + commercials.reporting (au minimum).
-- ------------------------------------------------------------
