-- Site de TEST : donne a l'utilisateur de la base de test tous les droits sur
-- les tables/sequences importees (creees par un autre role lors de l'import).
-- A importer via phpPgAdmin (base sc1fopa5058_test_pekegno) -> onglet "Importer".

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sc1fopa5058_test;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sc1fopa5058_test;
GRANT USAGE ON SCHEMA public TO sc1fopa5058_test;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO sc1fopa5058_test;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO sc1fopa5058_test;
