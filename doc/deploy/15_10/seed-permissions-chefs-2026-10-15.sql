-- ============================================================
-- PEKEGNO — Parité chefs (agence / département) avec l'admin (15/10/2026).
-- À importer via phpPgAdmin → onglet « Importer ».
-- Rejouable sans erreur (seules les lignes manquantes sont ajoutées).
--
-- Miroir exact de database/seeders/RoleSeeder.php (commit 15/10) pour les
-- rôles responsable-agence et responsable-departement :
--   encaissement factures, trésorerie, suppressions (dépenses, commissions,
--   comptabilité, catalogue), présences, référentiels pays/villes (lecture).
-- Aucune NOUVELLE permission : toutes existent déjà (seed de septembre).
-- ============================================================

-- Chef d'agence : 14 grants.
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'responsable-agence'
  AND p.name IN ('countries.consulter', 'cities.consulter', 'invoices.encaisser', 'tresories.consulter', 'tresories.modifier', 'comptabilite.supprimer', 'accounting-categories.supprimer', 'depenses.supprimer', 'commissions.supprimer', 'presences.creer', 'presences.supprimer', 'categories.supprimer', 'services.supprimer', 'products.supprimer')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Chef de département : 25 grants.
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'responsable-departement'
  AND p.name IN ('invoices.encaisser', 'tresories.consulter', 'tresories.modifier', 'comptabilite.consulter', 'comptabilite.creer', 'comptabilite.modifier', 'comptabilite.supprimer', 'comptabilite.exporter', 'accounting-categories.consulter', 'accounting-categories.creer', 'accounting-categories.modifier', 'accounting-categories.supprimer', 'bilans.consulter', 'bilans.exporter', 'depenses.supprimer', 'depenses.exporter', 'commissions.supprimer', 'commissions.exporter', 'countries.consulter', 'cities.consulter', 'presences.creer', 'presences.supprimer', 'categories.supprimer', 'services.supprimer', 'products.supprimer')
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ------------------------------------------------------------
-- Contrôles rapides (boîte SQL → SELECT uniquement) :
--   SELECT count(*) FROM role_permission rp JOIN roles r ON r.id = rp.role_id
--     JOIN permissions p ON p.id = rp.permission_id
--     WHERE r.name = 'responsable-agence'
--     AND p.name IN ('invoices.encaisser', 'tresories.consulter', 'tresories.modifier', 'comptabilite.supprimer', 'depenses.supprimer', 'commissions.supprimer');
--   -- attendu : 6
--   SELECT count(*) FROM role_permission rp JOIN roles r ON r.id = rp.role_id
--     JOIN permissions p ON p.id = rp.permission_id
--     WHERE r.name = 'responsable-departement'
--     AND p.name IN ('invoices.encaisser', 'tresories.consulter', 'comptabilite.supprimer', 'bilans.consulter', 'depenses.supprimer', 'commissions.supprimer');
--   -- attendu : 6
-- ------------------------------------------------------------
