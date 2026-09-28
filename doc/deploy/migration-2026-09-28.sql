-- Mise à jour production — tickets recette Academy du 28/09/2026.
-- Compatible PostgreSQL 9.6. À importer via phpPgAdmin (onglet Importer).
-- Rejouable sans erreur : si une partie est déjà en place, elle est simplement réappliquée.
-- Équivaut aux migrations Laravel :
--   2026_09_28_000001_add_discount_to_formation_enrollments_table (T5)
--   2026_09_28_000002_add_exchange_rate_to_countries_table (T11)

-- T5 : remise (pourcentage ou montant fixe) sur une inscription
ALTER TABLE formation_enrollments ADD COLUMN IF NOT EXISTS discount_type VARCHAR(255) NULL;
ALTER TABLE formation_enrollments DROP CONSTRAINT IF EXISTS formation_enrollments_discount_type_check;
ALTER TABLE formation_enrollments ADD CONSTRAINT formation_enrollments_discount_type_check
    CHECK (discount_type IN ('amount', 'percent'));
ALTER TABLE formation_enrollments ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2) NULL;
ALTER TABLE formation_enrollments DROP CONSTRAINT IF EXISTS formation_enrollments_discount_coherence;
ALTER TABLE formation_enrollments ADD CONSTRAINT formation_enrollments_discount_coherence CHECK (
    (discount_type IS NULL AND discount_value IS NULL)
    OR (discount_type = 'amount' AND discount_value IS NOT NULL AND discount_value >= 0)
    OR (discount_type = 'percent' AND discount_value IS NOT NULL
        AND discount_value > 0 AND discount_value <= 100)
);

-- T11 : taux d'équivalence du pays vers la monnaie du groupe (1 XOF = 1 XAF)
ALTER TABLE countries ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1;

-- T11 : monnaie d'affichage PEKEGNO GROUP (modifiable dans Réglages)
INSERT INTO settings (id, key, value, description, created_at, updated_at)
SELECT md5(random()::text || clock_timestamp()::text)::uuid, 'group_currency', '"XAF"',
       'Monnaie d''affichage des agrégats PEKEGNO GROUP', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'group_currency');

-- T4 : la caissière peut encaisser (payer) une commission
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'caissier' AND p.name = 'commissions.encaisser'
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Enregistre les migrations comme exécutées (évite un double passage via artisan)
INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES ('2026_09_28_000001_add_discount_to_formation_enrollments_table'),
             ('2026_09_28_000002_add_exchange_rate_to_countries_table')) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);
