-- Mise à jour production du 17/10/2026 — règlement du reste à payer + preuve de paiement.
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. doc/deploy/README.md §3.2).
-- Rejouable sans erreur : si la colonne existe déjà, elle est simplement ignorée.
--
-- Contenu : ajoute la colonne `amount` à `payment_proofs` (montant du reste à payer
-- porté par une preuve de règlement, nul pour les preuves d'avance déclarée).
-- Équivaut à la migration Laravel :
--   2026_10_17_000001_add_amount_to_payment_proofs_table
--
-- Aucune permission nouvelle : les routes utilisent invoices.creer / invoices.consulter /
-- invoices.valider qui existent déjà dans le seed de septembre (résponsable-agence,
-- responsable-departement, comptable, caissier ont invoices.consulter/creer/valider).

ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) NULL;

-- Enregistre la migration comme exécutée (évite un double passage via artisan).
INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES ('2026_10_17_000001_add_amount_to_payment_proofs_table')) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);

-- Contrôle (boîte SQL → SELECT uniquement) :
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'payment_proofs' AND column_name = 'amount';  -- 1 ligne attendue
-- SELECT migration FROM migrations ORDER BY id DESC LIMIT 3;  -- la 2026_10_17 en tête
