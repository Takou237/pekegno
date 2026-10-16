-- =====================================================================
-- PEKEGNO — REMISE A NEUF COMPLETE DE LA PROD (réseau vierge + 2 admins).
--
-- Vide la base de TOUTES les données métier : factures (+ lignes,
-- versements, preuves), clients / prospects / CRM, agences, pays, villes,
-- départements, catalogue (services, produits, formations, packages),
-- prestations (+ offres, actions, exécutions), contrats, abonnements,
-- commandes, inscriptions, dépenses, comptabilité, trésorerie, commissions,
-- points, et TOUS les utilisateurs — puis recrée uniquement :
--   admin@pekegno.com  (mot de passe : 12345678)
--   admin2@pekegno.com (mot de passe : 12345678)
--
-- CONSERVE (configuration, pas des données) : rôles, permissions et leurs
-- associations, réglages (settings, dont la monnaie du groupe et la
-- commission par défaut 20 %), l'organisation PEKEGNO GROUP, le plan
-- comptable (accounting_categories), les catégories de clients, les rôles
-- d'équipe client, et l'historique des migrations (la base reste « à jour »,
-- aucun ALTER à rejouer après).
-- NOTE : les règles de commission par entité (commission_rules) sont
-- supprimées avec le reste (elles pointaient vers des commerciaux / services
-- supprimés) ; la règle globale 20 % vit dans `settings` et est conservée.
-- Les lignes conservées dont l'agence / le département est supprimé passent
-- à NULL (FK ON DELETE SET NULL : settings.updated_by,
-- accounting_categories.agency_id, client_team_roles.department_id).
--
-- IRREVERSIBLE : faire d'abord une SAUVEGARDE
--   phpPgAdmin -> base sc1fopa5058_pekegno -> Exporter (structure + donnees).
-- Puis : phpPgAdmin -> base -> onglet "Importer" -> ce fichier
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
--
-- Technique : des DELETE ordonnés enfants -> parents (et NON un
-- TRUNCATE ... CASCADE, qui viderait aussi settings / accounting_categories /
-- client_team_roles via leurs FK). Les 3 seules FK RESTRICT concernées sont
-- respectées par l'ordre : services avant categories,
-- contracts + prestations avant users.
-- Compatible PostgreSQL 9.6. Rejouable : DELETE sur tables déjà vides
-- réussit, et les INSERT admin sont protégés par ON CONFLICT DO NOTHING.
-- Tout est dans une seule transaction : en cas d'erreur, rien n'est modifié.
-- =====================================================================

BEGIN;

-- 1. Journal, logs, tokens (pas de dépendants)
DELETE FROM activity_logs;
DELETE FROM login_logs;
DELETE FROM personal_access_tokens;
DELETE FROM password_reset_tokens;

-- 2. Lignes de détail et écritures (enfants des factures / inscriptions / sessions)
DELETE FROM formation_enrollments;
DELETE FROM session_participants;
DELETE FROM attendances;
DELETE FROM certificates;
DELETE FROM learner_observations;
DELETE FROM invoice_items;
DELETE FROM invoice_payments;
DELETE FROM payment_proofs;
DELETE FROM contract_services;
DELETE FROM subscription_notifications;
DELETE FROM order_lines;
DELETE FROM cart_items;
DELETE FROM expenses;
DELETE FROM accounting_transactions;
DELETE FROM treasury_transactions;
DELETE FROM daily_balances;

-- 3. Objets métier : CRM, contrats, commandes, inscriptions, actions
DELETE FROM companies;
DELETE FROM prospects;
DELETE FROM opportunities;
DELETE FROM activities;
DELETE FROM contracts;
DELETE FROM subscriptions;
DELETE FROM orders;
DELETE FROM carts;
DELETE FROM prestation_team_members;
DELETE FROM prestation_actions;
DELETE FROM prestation_action_comments;
DELETE FROM prestation_action_logs;
DELETE FROM prestation_action_reviews;
DELETE FROM prestation_action_executions;
DELETE FROM subscription_pack_services;
DELETE FROM package_items;
DELETE FROM package_recommendations;

-- 4. Profils vendeurs, équipes, caisse, règles de commission par entité
DELETE FROM commercial_points;
DELETE FROM trainer_points;
DELETE FROM commission_entries;
DELETE FROM commission_payments;
DELETE FROM commission_rules;
DELETE FROM commercials;
DELETE FROM trainers;
DELETE FROM seller_profiles;
DELETE FROM team_members;
DELETE FROM agency_activities;
DELETE FROM agency_payment_methods;
DELETE FROM agency_notifications;
DELETE FROM treasury_accounts;
DELETE FROM user_assignments;
DELETE FROM department_chiefs;
DELETE FROM course_modules;
DELETE FROM course_course_category;

-- 5. Catalogue : inscriptions déjà vidées, puis offres/prestations/contrats
--    enfants avant leurs parents (packs, formations, agences)
DELETE FROM invoices;
DELETE FROM prestation_offers;
DELETE FROM prestations;
DELETE FROM subscription_packs;
DELETE FROM courses;
DELETE FROM promotions;
DELETE FROM products;
DELETE FROM services;
DELETE FROM training_sessions;
DELETE FROM sessions;

-- 6. Référentiels catalogue (parents : RESTRICT services -> categories respecté)
DELETE FROM categories;
DELETE FROM agency_categories;
DELETE FROM course_categories;

-- 7. Organisation : départements puis agences, villes, pays
DELETE FROM departments;
DELETE FROM agencies;
DELETE FROM cities;
DELETE FROM countries;

-- 8. Utilisateurs en dernier (FK RESTRICT depuis contracts.client_id et
--    prestations.client_id déjà vidés ; le reste est CASCADE / SET NULL)
DELETE FROM users;

-- 9. Les 2 seuls comptes de la base neuve (mot de passe : 12345678 dans les 2 cas).
-- Super-admin historique (mêmes id / hash que seed-admin.sql).
INSERT INTO users (
    id, username, email, password, first_name, last_name,
    is_active, is_password_change_required, role_id, created_at, updated_at
) VALUES (
    '72bf026f-7718-6837-a44f-c25a9cbdd4d7',
    'admin',
    'admin@pekegno.com',
    '$2y$12$26As57GFlUg3KZDXiLM2z.tZeulZr6d2S7j6FOk9bmG8mP4TZWoqy',
    'Admin',
    'PEKEGNO',
    true,
    false,
    (SELECT id FROM roles WHERE name = 'super-admin'),
    now(), now()
)
ON CONFLICT (email) DO NOTHING;

-- Deuxième super-admin (mot de passe : 12345678).
INSERT INTO users (
    id, username, email, password, first_name, last_name,
    is_active, is_password_change_required, role_id, created_at, updated_at
) VALUES (
    '9b06de8f-b392-4e6f-bd5f-5688f2598369',
    'admin2',
    'admin2@pekegno.com',
    '$2y$12$26As57GFlUg3KZDXiLM2z.tZeulZr6d2S7j6FOk9bmG8mP4TZWoqy',
    'Admin2',
    'PEKEGNO',
    true,
    false,
    (SELECT id FROM roles WHERE name = 'super-admin'),
    now(), now()
)
ON CONFLICT (email) DO NOTHING;

COMMIT;

-- Contrôle (boîte SQL -> SELECT uniquement ; tout doit valoir 0 sauf les 2 admins
-- et les tables de configuration conservées) :
-- SELECT (SELECT COUNT(*) FROM users) AS utilisateurs,
--        (SELECT COUNT(*) FROM invoices) AS factures,
--        (SELECT COUNT(*) FROM agencies) AS agences,
--        (SELECT COUNT(*) FROM countries) AS pays,
--        (SELECT COUNT(*) FROM departments) AS departements,
--        (SELECT COUNT(*) FROM products) AS produits,
--        (SELECT COUNT(*) FROM prestations) AS prestations,
--        (SELECT COUNT(*) FROM subscription_packs) AS packages,
--        (SELECT COUNT(*) FROM courses) AS formations,
--        (SELECT COUNT(*) FROM prospects) AS prospects;
-- SELECT email, is_active FROM users ORDER BY email;
--   -- attendu : admin2@pekegno.com + admin@pekegno.com, actifs
-- SELECT COUNT(*) FROM roles;            -- conservés
-- SELECT COUNT(*) FROM permissions;      -- conservées
-- SELECT key, value FROM settings WHERE key LIKE 'default_commission%' OR key = 'group_currency';
