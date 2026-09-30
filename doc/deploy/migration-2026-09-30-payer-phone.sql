-- Mise à jour production du 30/09/2026 : téléphone du payeur mobile money dans la vente.
-- (à importer APRÈS migration-2026-09-30-2fa.sql)
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin (onglet Importer). Rejouable sans erreur.
--
-- invoices.payer_phone : numéro ayant payé par mobile money (Orange Money / MoMo),
-- obligatoire pour ces moyens de paiement côté API, NULL pour un règlement en espèces.
-- Les factures existantes restent à NULL.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payer_phone VARCHAR(50) NULL;

INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES ('2026_09_30_000003_add_payer_phone_to_invoices_table')) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);
