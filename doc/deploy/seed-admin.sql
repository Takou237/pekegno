-- Cree le role super-admin + un utilisateur admin (mot de passe: 12345678)
-- A importer via phpPgAdmin -> onglet "Importer" (pas la boite SQL, qui casse sur ce serveur).

INSERT INTO roles (id, name, description, created_at, updated_at)
VALUES (
    'f510b2f9-24c3-504a-cd24-b8ec11c1a140',
    'super-admin',
    'Acces complet a l''ensemble de l''application',
    now(), now()
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (
    id, username, email, password, first_name, last_name,
    is_active, is_password_change_required, role_id, created_at, updated_at
) VALUES (
    '72bf026f-7718-6837-a44f-c25a9cbdd4d7',
    'admin',
    'admin@pekegno.com',
    '$2y$12$26As57GFlUg3KZDXiLM2z.tZeulZr6d2S7j6FOk9bmG8mP4TZWoqy',
    'Admin',
    'PEKEGNO',
    true,
    false,
    'f510b2f9-24c3-504a-cd24-b8ec11c1a140',
    now(), now()
)
ON CONFLICT (email) DO NOTHING;
