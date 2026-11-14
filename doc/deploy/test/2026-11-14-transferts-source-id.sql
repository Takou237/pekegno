-- Site de TEST — migration 2026_11_14_000002 (transferts entre caisses).
-- A importer via phpPgAdmin -> base sc1fopa5058_pekegno_test -> onglet « Importer »
-- (l'ALTER TABLE exige le proprietaire des tables : le role de phpPgAdmin).
-- Rejouable.

ALTER TABLE treasury_transactions ALTER COLUMN source_id TYPE varchar(64) USING source_id::text;

INSERT INTO migrations (migration, batch)
SELECT '2026_11_14_000002_treasury_transaction_source_id_as_text', COALESCE(MAX(batch), 0) + 1
FROM migrations
WHERE NOT EXISTS (
    SELECT 1 FROM migrations WHERE migration = '2026_11_14_000002_treasury_transaction_source_id_as_text'
);
