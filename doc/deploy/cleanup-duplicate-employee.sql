-- Supprime les 4 doublons crees pendant le debug du bug de validation
-- (aucun des 4 n'a la bonne combinaison compte lie + commission).
-- A importer via phpPgAdmin -> onglet Importer.

DELETE FROM commercials WHERE email = 'love@gmail.com';
