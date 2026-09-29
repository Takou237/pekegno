-- =====================================================================
-- REMISE A ZERO DE TOUTES LES TRANSACTIONS (CA, encaissements, depenses,
-- tresorerie, comptabilite, commissions, points, inscriptions...).
--
-- IRREVERSIBLE : faire d'abord une sauvegarde
--   phpPgAdmin -> base sc1fopa5058_pekegno -> Exporter (structure + donnees).
-- Puis : phpPgAdmin -> base -> onglet "Importer" -> ce fichier.
--
-- CONSERVE : pays, villes, agences, departements, utilisateurs/clients,
--   roles/permissions, reglages, catalogue (services, produits, formations,
--   modules, sessions de formation, packs), commerciaux, formateurs,
--   profils vendeurs, regles de commission, comptes de tresorerie
--   (mais leur solde d'ouverture est remis a 0), journal d'audit.
--
-- Tout est dans une seule transaction : en cas d'erreur, rien n'est modifie.
-- La numerotation (factures PK-AAAAMMJJ-NNN, pieces comptables, depenses...)
-- est calculee a partir des donnees : elle repart automatiquement de 1.
-- =====================================================================

BEGIN;

-- Commissions et points
DELETE FROM commission_payments;
DELETE FROM commission_entries;
DELETE FROM commercial_points;
DELETE FROM trainer_points;
UPDATE commercials SET points_balance = 0;
UPDATE trainers    SET points_balance = 0;

-- Academy : inscriptions (+ certificats et participants de session en cascade)
DELETE FROM certificates;
DELETE FROM session_participants;
DELETE FROM formation_enrollments;

-- Abonnements (ventes d'abonnements + relances planifiees)
DELETE FROM subscription_notifications;
DELETE FROM subscriptions;

-- Commandes et paniers (espace client)
DELETE FROM order_lines;
DELETE FROM orders;
DELETE FROM cart_items;
DELETE FROM carts;

-- Factures, paiements, preuves de paiement => CA a zero
DELETE FROM payment_proofs;
DELETE FROM invoice_payments;
DELETE FROM invoice_items;
DELETE FROM invoices;

-- Depenses, comptabilite, tresorerie, bilans journaliers
DELETE FROM expenses;
DELETE FROM accounting_transactions;
DELETE FROM treasury_transactions;
DELETE FROM daily_balances;
UPDATE treasury_accounts SET opening_balance = 0;

-- ---------------------------------------------------------------------
-- OPTIONNEL : CRM (contrats, opportunites, prospects). Ce ne sont pas des
-- encaissements, donc conserves par defaut. Retirer les "-- " pour vider.
-- ---------------------------------------------------------------------
-- DELETE FROM contract_services;
-- DELETE FROM contracts;
-- DELETE FROM opportunities;
-- DELETE FROM prospects;

COMMIT;

-- Controle (a lancer ensuite dans la boite SQL, tout doit valoir 0) :
-- SELECT (SELECT COUNT(*) FROM invoices) AS factures,
--        (SELECT COUNT(*) FROM invoice_payments) AS paiements,
--        (SELECT COUNT(*) FROM expenses) AS depenses,
--        (SELECT COUNT(*) FROM accounting_transactions) AS compta,
--        (SELECT COUNT(*) FROM treasury_transactions) AS tresorerie,
--        (SELECT COUNT(*) FROM commission_entries) AS commissions,
--        (SELECT COUNT(*) FROM formation_enrollments) AS inscriptions,
--        (SELECT COALESCE(SUM(opening_balance), 0) FROM treasury_accounts) AS soldes_ouverture
