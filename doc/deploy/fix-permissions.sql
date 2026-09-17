-- Donne a l'utilisateur applicatif tous les droits sur les tables/sequences
-- deja creees (necessaire car elles ont ete creees par un autre role lors
-- de l'import de schema.sql). A importer via phpPgAdmin -> onglet "Importer".

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sc1fopa5058_sc1fopa5058;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sc1fopa5058_sc1fopa5058;
GRANT USAGE ON SCHEMA public TO sc1fopa5058_sc1fopa5058;

-- Pour que les futures tables/sequences (si on rejoue des migrations plus tard)
-- heritent aussi de ces droits automatiquement.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO sc1fopa5058_sc1fopa5058;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO sc1fopa5058_sc1fopa5058;
