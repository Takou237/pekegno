-- Deuxieme compte super-admin (mot de passe: 12345678)
-- A importer via phpPgAdmin -> onglet "Importer".

INSERT INTO users (
    id, username, email, password, first_name, last_name,
    is_active, is_password_change_required, role_id, created_at, updated_at
) VALUES (
    '1212ecb4-4ea5-fdcf-cbed-4a6e470ee089',
    'Mike',
    'kengnem070@gmail.com',
    '$2y$12$26As57GFlUg3KZDXiLM2z.tZeulZr6d2S7j6FOk9bmG8mP4TZWoqy',
    'Mike',
    NULL,
    true,
    false,
    (SELECT id FROM roles WHERE name = 'super-admin'),
    now(), now()
)
ON CONFLICT (email) DO NOTHING;
