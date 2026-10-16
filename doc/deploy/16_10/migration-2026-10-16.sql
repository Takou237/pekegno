-- ============================================================
-- PEKEGNO — Mise à jour production du 16/10/2026 (lot A_FAIRE)
-- État prod de départ : lots 13/10 + 14/10 + 15/10 appliqués
--   (voir doc/deploy/13_10, 14_10, 15_10 + README.md §1).
-- Si ces lots ne sont pas encore passés en prod, les appliquer D'ABORD.
--
-- Contenu : rattrapage géographique des agences (CA Côte d'Ivoire à 0) —
--   les agences historiques ont `country`/`city` (varchar) mais
--   `country_id`/`city_id` NULL, si bien que tous les filtres pays
--   (whereIn sur country_id) rendaient 0. Équivaut à la migration Laravel :
--   2026_10_16_000001_backfill_agency_country_city_fk (données seules,
--   AUCUN changement de schéma).
-- Le code 16/10 fonctionne même sans ce rattrapage (repli libellé legacy
--   via Agency::idsForCountry), mais les FK normalisées sont préférables.
--
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
-- Rejouable sans erreur (ne touche que les FK encore NULL).
-- ============================================================

BEGIN;

-- Passe 1 : correspondance exacte sur le nom du pays.
UPDATE agencies a
SET country_id = c.id, updated_at = now()
FROM countries c
WHERE a.country_id IS NULL
  AND a.country IS NOT NULL
  AND c.name = a.country;

-- Passe 2 : correspondance insensible à la casse pour le reliquat
-- (ex. « côte d'ivoire » vs « Côte d'Ivoire »).
UPDATE agencies a
SET country_id = c.id, updated_at = now()
FROM countries c
WHERE a.country_id IS NULL
  AND a.country IS NOT NULL
  AND LOWER(c.name) = LOWER(a.country);

-- Villes : correspondance exacte, scoping pays quand il est connu…
UPDATE agencies a
SET city_id = ci.id, updated_at = now()
FROM cities ci
WHERE a.city_id IS NULL
  AND a.city IS NOT NULL
  AND ci.name = a.city
  AND (a.country_id IS NULL OR ci.country_id = a.country_id);

-- …puis insensible à la casse pour le reliquat.
UPDATE agencies a
SET city_id = ci.id, updated_at = now()
FROM cities ci
WHERE a.city_id IS NULL
  AND a.city IS NOT NULL
  AND LOWER(ci.name) = LOWER(a.city)
  AND (a.country_id IS NULL OR ci.country_id = a.country_id);

-- Enregistre la migration comme exécutée (évite un double passage via artisan).
INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES ('2026_10_16_000001_backfill_agency_country_city_fk')) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);

COMMIT;

-- Contrôle (boîte SQL → SELECT uniquement) :
-- SELECT COUNT(*) FROM agencies WHERE country_id IS NULL;  -- attendu : 0 (ou seulement des agences sans pays du tout)
-- SELECT c.name, COUNT(a.id) FROM countries c LEFT JOIN agencies a ON a.country_id = c.id GROUP BY c.name ORDER BY 1;
-- SELECT migration FROM migrations ORDER BY id DESC LIMIT 3;  -- la 2026_10_16 en tête
