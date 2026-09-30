-- Mise à jour production du 30/09/2026 : 2FA multi-canal (code de vérification
-- par email en plus du TOTP / app authenticator).
-- (à importer APRÈS migration-2026-09-30.sql)
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin (onglet Importer). Rejouable sans erreur.
--
-- La colonne two_factor_channel porte le canal de réception du code 2FA :
--   'totp'  = application d'authentification (QR code) — valeur par défaut,
--             comportement identique à avant la mise à jour ;
--   'email' = code à 6 chiffres envoyé par email à chaque connexion.
-- Aucun utilisateur existant n'est modifié : tout le monde reste en 'totp',
-- chacun choisit 'email' depuis son profil s'il le souhaite.

ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_channel VARCHAR(20) NOT NULL DEFAULT 'totp';

-- Garde-fou : seul 'totp' ou 'email' doit pouvoir être écrit.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_two_factor_channel_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_two_factor_channel_check CHECK (two_factor_channel IN ('totp', 'email'));
  END IF;
END $$;

-- Les clients du portail client n'ont pas d'app authenticator imposée :
-- leur canal est forcé à 'email' par l'API (TwoFactorController::enable).
-- Rien à faire ici pour eux : la colonne ne fait que refléter le choix.

INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES ('2026_09_30_000002_add_two_factor_channel_to_users_table')) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);
