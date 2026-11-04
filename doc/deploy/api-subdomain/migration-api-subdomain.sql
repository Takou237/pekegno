-- ============================================================
-- PEKEGNO — Bascule de l'API vers api.plateforme.pekegnogroup.com
--
-- Les URL de fichiers uploadés sont enregistrées en absolu
-- (https://pekegnogroup.com/storage/...) : images de formations et de
-- services, cachet des pays, preuves d'actions de prestation, etc.
-- Une fois le domaine principal rendu au site vitrine, ces liens
-- casseraient. Ce script remplace, dans TOUTES les colonnes texte / JSON
-- du schéma public :
--     https://pekegnogroup.com/storage/      → https://api.plateforme.pekegnogroup.com/storage/
--     http://pekegnogroup.com/storage/       → https://api.plateforme.pekegnogroup.com/storage/
--     https://www.pekegnogroup.com/storage/  → https://api.plateforme.pekegnogroup.com/storage/
-- (seul le préfixe /storage/ est touché : aucun autre texte n'est modifié).
--
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin → onglet « Importer »
-- (jamais copier-coller dans la boîte SQL, cf. README §3.2).
-- Rejouable sans effet (une URL déjà basculée ne correspond plus).
-- Une seule transaction : en cas d'erreur, rien n'est modifié.
-- ============================================================

BEGIN;

DO $$
DECLARE
  col RECORD;
  n   BIGINT;
  total BIGINT := 0;
  expr TEXT;
BEGIN
  FOR col IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying', 'json', 'jsonb')
      AND c.table_name NOT IN ('migrations', 'sessions', 'cache', 'cache_locks', 'jobs', 'failed_jobs')
  LOOP
    expr := format(
      'replace(replace(replace(%I::text, %L, %L), %L, %L), %L, %L)',
      col.column_name,
      'https://www.pekegnogroup.com/storage/', 'https://api.plateforme.pekegnogroup.com/storage/',
      'https://pekegnogroup.com/storage/',     'https://api.plateforme.pekegnogroup.com/storage/',
      'http://pekegnogroup.com/storage/',      'https://api.plateforme.pekegnogroup.com/storage/'
    );

    EXECUTE format(
      'UPDATE %I SET %I = (%s)::%s WHERE %I::text LIKE %L OR %I::text LIKE %L OR %I::text LIKE %L',
      col.table_name,
      col.column_name,
      expr,
      CASE col.data_type WHEN 'character varying' THEN 'varchar' ELSE col.data_type END,
      col.column_name, '%https://pekegnogroup.com/storage/%',
      col.column_name, '%http://pekegnogroup.com/storage/%',
      col.column_name, '%https://www.pekegnogroup.com/storage/%'
    );
    GET DIAGNOSTICS n = ROW_COUNT;

    IF n > 0 THEN
      RAISE NOTICE '%.% : % ligne(s) mise(s) à jour', col.table_name, col.column_name, n;
      total := total + n;
    END IF;
  END LOOP;

  RAISE NOTICE 'Total : % valeur(s) basculée(s) vers api.plateforme.pekegnogroup.com', total;
END
$$;

COMMIT;

-- ------------------------------------------------------------
-- Contrôle (boîte SQL → SELECT uniquement) : doit renvoyer 0 ligne
-- SELECT id, cover_image FROM services WHERE cover_image LIKE 'https://pekegnogroup.com/storage/%';
-- SELECT id, cover_image FROM courses  WHERE cover_image LIKE 'https://pekegnogroup.com/storage/%';
-- ------------------------------------------------------------
