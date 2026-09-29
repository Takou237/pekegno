-- Mise à jour production du 30/09/2026 : reçu imprimable pour chaque versement.
-- (à importer APRÈS migration-2026-09-29.sql)
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin (onglet Importer). Rejouable sans erreur.

-- Numéro de reçu de chaque versement : REC-AAAAMMJJ-NNN
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(30) NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_receipt_number_unique') THEN
    ALTER TABLE invoice_payments ADD CONSTRAINT invoice_payments_receipt_number_unique UNIQUE (receipt_number);
  END IF;
END $$;

-- Versements déjà enregistrés : numérotés dans l'ordre de paiement, par jour (heure de Douala).
UPDATE invoice_payments p
SET receipt_number = n.receipt_number
FROM (
  SELECT id,
         'REC-' || to_char(COALESCE(paid_at, created_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Douala', 'YYYYMMDD')
         || '-' || lpad(row_number() OVER (
              PARTITION BY to_char(COALESCE(paid_at, created_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Douala', 'YYYYMMDD')
              ORDER BY paid_at, created_at, id
            )::text, 3, '0') AS receipt_number
  FROM invoice_payments
  WHERE receipt_number IS NULL
) n
WHERE p.id = n.id;

INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES ('2026_09_30_000001_add_receipt_number_to_invoice_payments_table')) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);
