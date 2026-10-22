-- ============================================================
-- PEKEGNO — Règles de commission par défaut (grille de rémunération) — 22/10/2026
-- À importer APRÈS migration-2026-10-22.sql, via phpPgAdmin → onglet « Importer ».
-- Miroir exact de database/seeders/DefaultCommissionRulesSeeder.php (18 règles).
--
-- Chaque règle est créée avec ses rôles bénéficiaires dans la même instruction.
-- Les règles « à définir / à préciser » de la grille sont créées INACTIVES
-- (elles s'activent en les enregistrant depuis Réglages > Commissions).
-- « Formateurs — 10 % ventes de livres » / « 10 % Canva Pro » ne sont actives que
-- si une catégorie « Livre… » / un produit « …Canva… » existe déjà au catalogue.
--
-- Rejouable sans effet : une règle déjà présente (même nom) n'est ni recréée ni
-- modifiée — les réglages faits depuis l'interface sont conservés.
-- Prérequis : au moins un compte super-admin (créateur des règles).
-- Compatible PostgreSQL 9.6 (validé sur un conteneur postgres:9.6).
-- Une seule transaction : en cas d'erreur, rien n'est modifié.
-- ============================================================

BEGIN;

-- 1. Commerciaux — paliers CA mensuel  [rôles : commercial]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id1')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp1')::uuid,
         1,
         'Commerciaux — paliers CA mensuel',
         'monthly_revenue',
         NULL,
         '≥1M : 0,5 % ; ≥2M : 1 % ; ≥3M : 2 % ; ≥4M : 2 % + 50 000 si recouvrement N-1 ≥ 80 % ; ≥5M : 3 % + 50 000 + cagnotte 100 000 si recouvrement N-1 ≥ 80 %.',
         'on_payment',
         'tiered',
         NULL,
         NULL,
         '[{"min":1000000,"percent":0.5},{"min":2000000,"percent":1},{"min":3000000,"percent":2},{"min":4000000,"percent":2,"fixed_bonus":50000,"bonus_requires_recovery":true},{"min":5000000,"percent":3,"fixed_bonus":50000,"pot_bonus":100000,"bonus_requires_recovery":true}]'::jsonb,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         80,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Commerciaux — paliers CA mensuel')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('commercial');

-- 2. Formateurs — 10 % ventes de livres  [rôles : formateur]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id2')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp2')::uuid,
         1,
         'Formateurs — 10 % ventes de livres',
         'sale',
         NULL,
         CASE WHEN (SELECT id FROM categories WHERE lower(name) LIKE 'livre%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) IS NOT NULL THEN 'Ventes de la catégorie « ' || (SELECT name FROM categories WHERE id = (SELECT id FROM categories WHERE lower(name) LIKE 'livre%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1)) || ' ».' ELSE 'À compléter : choisir la catégorie des livres.' END,
         'on_payment',
         'percent',
         10,
         NULL,
         NULL,
         NULL,
         NULL,
         (SELECT id FROM categories WHERE lower(name) LIKE 'livre%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1),
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         ((SELECT id FROM categories WHERE lower(name) LIKE 'livre%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) IS NOT NULL),
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Formateurs — 10 % ventes de livres')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('formateur');

-- 3. Formateurs — 10 % Canva Pro  [rôles : formateur]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id3')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp3')::uuid,
         1,
         'Formateurs — 10 % Canva Pro',
         'sale',
         CASE WHEN (SELECT id FROM products WHERE lower(name) LIKE '%canva%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) IS NOT NULL THEN 'product' WHEN (SELECT id FROM services WHERE lower(name) LIKE '%canva%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) IS NOT NULL THEN 'service' END,
         CASE WHEN (SELECT id FROM products WHERE lower(name) LIKE '%canva%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) IS NOT NULL OR (SELECT id FROM services WHERE lower(name) LIKE '%canva%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) IS NOT NULL THEN 'Ventes de Canva Pro.' ELSE 'À compléter : choisir le produit Canva Pro (absent du catalogue).' END,
         'on_payment',
         'percent',
         10,
         NULL,
         NULL,
         (SELECT id FROM products WHERE lower(name) LIKE '%canva%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1),
         CASE WHEN (SELECT id FROM products WHERE lower(name) LIKE '%canva%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) IS NULL THEN (SELECT id FROM services WHERE lower(name) LIKE '%canva%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) END,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         ((SELECT id FROM products WHERE lower(name) LIKE '%canva%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) IS NOT NULL OR (SELECT id FROM services WHERE lower(name) LIKE '%canva%' AND deleted_at IS NULL ORDER BY created_at LIMIT 1) IS NOT NULL),
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Formateurs — 10 % Canva Pro')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('formateur');

-- 4. Formateurs — 10 % upgrades  [rôles : formateur]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id4')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp4')::uuid,
         1,
         'Formateurs — 10 % upgrades',
         'upgrade',
         NULL,
         NULL,
         'on_payment',
         'percent',
         10,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Formateurs — 10 % upgrades')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('formateur');

-- 5. Formateurs — 10 % recommandations  [rôles : formateur]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id5')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp5')::uuid,
         1,
         'Formateurs — 10 % recommandations',
         'sale',
         'course',
         'Formations vendues ou recommandées par le formateur (formateur vendeur de l''inscription).',
         'on_payment',
         'percent',
         10,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Formateurs — 10 % recommandations')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('formateur');

-- 6. Formateurs — prime témoignage  [rôles : formateur]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id6')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp6')::uuid,
         1,
         'Formateurs — prime témoignage',
         'manual',
         NULL,
         'Attribuée après validation qualité du témoignage.',
         'on_payment',
         'fixed',
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         10000,
         25000,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Formateurs — prime témoignage')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('formateur');

-- 7. Community managers — 2 % chaque renouvellement  [rôles : community-manager]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id7')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp7')::uuid,
         1,
         'Community managers — 2 % chaque renouvellement',
         'renewal',
         NULL,
         'Renouvellement mensuel (remplacé par la règle du 3e / 6e renouvellement quand elle s''applique).',
         'on_payment',
         'percent',
         2,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Community managers — 2 % chaque renouvellement')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('community-manager');

-- 8. Community managers — 5 % 3e renouvellement  [rôles : community-manager]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id8')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp8')::uuid,
         1,
         'Community managers — 5 % 3e renouvellement',
         'renewal',
         NULL,
         NULL,
         'on_payment',
         'percent',
         5,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         3,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Community managers — 5 % 3e renouvellement')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('community-manager');

-- 9. Community managers — 10 % 6e renouvellement  [rôles : community-manager]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id9')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp9')::uuid,
         1,
         'Community managers — 10 % 6e renouvellement',
         'renewal',
         NULL,
         NULL,
         'on_payment',
         'percent',
         10,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         6,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Community managers — 10 % 6e renouvellement')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('community-manager');

-- 10. Community managers — 10 % upgrades de packages  [rôles : community-manager]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id10')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp10')::uuid,
         1,
         'Community managers — 10 % upgrades de packages',
         'upgrade',
         'package',
         NULL,
         'on_payment',
         'percent',
         10,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Community managers — 10 % upgrades de packages')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('community-manager');

-- 11. Infographiste / Monteur vidéo — prime qualité / quantité  [rôles : aucun (à définir)]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id11')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp11')::uuid,
         1,
         'Infographiste / Monteur vidéo — prime qualité / quantité',
         'manual',
         NULL,
         'Au-delà du volume attendu. Règle à définir avant activation (créer le rôle et l''attribuer).',
         'on_payment',
         'fixed',
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Infographiste / Monteur vidéo — prime qualité / quantité')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
SELECT count(*) FROM ins;

-- 12. Agent IA — prime innovation / volume / formation  [rôles : aucun (à définir)]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id12')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp12')::uuid,
         1,
         'Agent IA — prime innovation / volume / formation',
         'manual',
         NULL,
         'Règle à définir avant activation (créer le rôle et l''attribuer).',
         'on_payment',
         'fixed',
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Agent IA — prime innovation / volume / formation')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
SELECT count(*) FROM ins;

-- 13. Caisse / Finance — prime de performance  [rôles : caissier]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id13')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp13')::uuid,
         1,
         'Caisse / Finance — prime de performance',
         'manual',
         NULL,
         'Réduction des pertes, qualité du recouvrement, fiabilité des caisses/rapports : indicateurs et formules à définir.',
         'on_payment',
         'fixed',
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Caisse / Finance — prime de performance')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('caissier');

-- 14. Chef Pekegno Agency — 2 % 3e renouvellement  [rôles : responsable-departement]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id14')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp14')::uuid,
         1,
         'Chef Pekegno Agency — 2 % 3e renouvellement',
         'renewal',
         NULL,
         NULL,
         'on_payment',
         'percent',
         2,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         3,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Chef Pekegno Agency — 2 % 3e renouvellement')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('responsable-departement');

-- 15. Chef Pekegno Agency — 5 % 6e renouvellement  [rôles : responsable-departement]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id15')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp15')::uuid,
         1,
         'Chef Pekegno Agency — 5 % 6e renouvellement',
         'renewal',
         NULL,
         NULL,
         'on_payment',
         'percent',
         5,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         6,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Chef Pekegno Agency — 5 % 6e renouvellement')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('responsable-departement');

-- 16. Chef Pekegno Agency — 10 % renouvellement à date  [rôles : responsable-departement]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id16')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp16')::uuid,
         1,
         'Chef Pekegno Agency — 10 % renouvellement à date',
         'renewal',
         NULL,
         'Assiette exacte à préciser avant activation.',
         'on_payment',
         'percent',
         10,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         true,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Chef Pekegno Agency — 10 % renouvellement à date')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('responsable-departement');

-- 17. Chef Pekegno Agency — 10 % upgrades  [rôles : responsable-departement]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id17')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp17')::uuid,
         1,
         'Chef Pekegno Agency — 10 % upgrades',
         'upgrade',
         'package',
         'Assiette exacte à préciser avant activation.',
         'on_payment',
         'percent',
         10,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'own',
         NULL,
         'previous_month',
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Chef Pekegno Agency — 10 % upgrades')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('responsable-departement');

-- 18. Chefs d'agence — objectif ×3 vs même mois N-1  [rôles : responsable-agence]
WITH ins AS (
  INSERT INTO commission_rules (id, rule_group_id, version, name, basis, target_kind, description, trigger_event, formula_type, percent_value, fixed_amount, tiers_json, product_id, service_id, category_id, renewal_number, renewal_on_time, revenue_scope, min_recovery_rate, recovery_period, growth_multiplier, max_percent, bonus_min, bonus_max, is_active, created_by, created_at, updated_at)
  SELECT md5(random()::text || clock_timestamp()::text || 'id18')::uuid,
         md5(random()::text || clock_timestamp()::text || 'grp18')::uuid,
         1,
         'Chefs d''agence — objectif ×3 vs même mois N-1',
         'growth',
         NULL,
         'Pourcentage variable selon le dépassement, jusqu''à 2 %. Paliers exacts à préciser avant activation (exemple pré-rempli).',
         'on_payment',
         'tiered',
         NULL,
         NULL,
         '[{"min":3,"percent":1},{"min":4,"percent":1.5},{"min":5,"percent":2}]'::jsonb,
         NULL,
         NULL,
         NULL,
         NULL,
         false,
         'agency',
         NULL,
         'previous_month',
         3,
         2,
         NULL,
         NULL,
         false,
         (SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin' ORDER BY u.created_at LIMIT 1),
         now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Chefs d''agence — objectif ×3 vs même mois N-1')
    AND EXISTS (SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.name = 'super-admin')
  RETURNING rule_group_id
)
INSERT INTO commission_rule_role (rule_group_id, role_id, created_at, updated_at)
SELECT ins.rule_group_id, ro.id, now(), now() FROM ins CROSS JOIN roles ro WHERE ro.name IN ('responsable-agence');

COMMIT;

-- ------------------------------------------------------------
-- Contrôles (boîte SQL → SELECT uniquement) :
-- SELECT count(*) FROM commission_rules WHERE basis IS NOT NULL;   -- ≥ 18
-- SELECT cr.name, cr.basis, cr.renewal_number, cr.is_active, string_agg(r.name, ', ') AS roles
--   FROM commission_rules cr
--   LEFT JOIN commission_rule_role crr ON crr.rule_group_id = cr.rule_group_id
--   LEFT JOIN roles r ON r.id = crr.role_id
--   GROUP BY cr.id ORDER BY cr.created_at;
-- ------------------------------------------------------------
