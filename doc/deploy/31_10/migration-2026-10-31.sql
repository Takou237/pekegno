-- ============================================================
-- PEKEGNO — Mise à jour production du 31/10/2026
--   (type de durée des sessions de formation)
-- État prod de départ : lot du 30/10/2026 (2) appliqué (dernière migration :
--   2026_10_30_000003_grant_session_delete_to_department_chief).
--
-- Contenu : 1 migration Laravel :
--   A. 2026_10_31_000001_add_duration_type_to_training_sessions_table
--      training_sessions.duration_type ('limited' | 'unlimited', défaut
--      'unlimited'). Les sessions existantes ayant une date de fin passent
--      en 'limited'.
-- Aucune permission, aucune route.
--
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
-- Rejouable sans erreur (IF NOT EXISTS, INSERT protégé). Une seule
-- transaction : en cas d'erreur, rien n'est modifié.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. Type de durée des sessions — 2026_10_31_000001
-- ------------------------------------------------------------
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS duration_type VARCHAR(20) NOT NULL DEFAULT 'unlimited';

-- Une session avec une date de fin est « limitée » (une session illimitée
-- n'a jamais de date de fin : rejouable sans effet de bord).
UPDATE training_sessions
SET duration_type = 'limited'
WHERE end_at IS NOT NULL AND duration_type <> 'limited';

-- ------------------------------------------------------------
-- B. Marque la migration comme exécutée (évite tout rejeu via artisan)
-- ------------------------------------------------------------
INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES
  ('2026_10_31_000001_add_duration_type_to_training_sessions_table')
) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);

COMMIT;

-- ------------------------------------------------------------
-- Contrôles (boîte SQL → SELECT uniquement) :
-- SELECT migration FROM migrations WHERE migration LIKE '2026_10_31%';  -- 1 ligne
-- SELECT duration_type, COUNT(*), COUNT(end_at) FROM training_sessions GROUP BY 1;
--   -- 'unlimited' : COUNT(end_at) = 0 ; 'limited' : toutes les sessions avec date de fin
-- ------------------------------------------------------------
