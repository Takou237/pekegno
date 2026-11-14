-- Site de TEST : droits de l'utilisateur sc1fopa5058_sc1fopa5058 (celui du
-- .env de test) sur la base sc1fopa5058_pekegno_test, dont les tables et
-- sequences ont ete creees par l'import phpPgAdmin (autre role).
-- A importer via phpPgAdmin -> base sc1fopa5058_pekegno_test -> onglet « Importer ».

GRANT USAGE ON SCHEMA public TO sc1fopa5058_sc1fopa5058;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sc1fopa5058_sc1fopa5058;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sc1fopa5058_sc1fopa5058;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO sc1fopa5058_sc1fopa5058;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO sc1fopa5058_sc1fopa5058;
