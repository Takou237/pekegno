-- PEKEGNO — 01/10/2026 — Rattache à leur agence / commercial les clients issus
-- d'une conversion de prospect faite par un commercial.
--
-- Avant ce correctif, « Convertir en client » créait le client sans agence
-- (registered_agency_id NULL) : le commercial (borné à son agence) ne le
-- retrouvait plus nulle part. Le prospect étant supprimé à la conversion, on
-- retrouve le commercial grâce au journal d'activité (action « converted »).
--
-- Idempotent : ne touche que les clients encore sans agence.
-- À importer via phpPgAdmin → onglet « Importer » (piège #3.2).

UPDATE users AS u
SET registered_agency_id = c.agency_id,
    commercial_user_id   = COALESCE(u.commercial_user_id, c.user_id),
    registered_at        = COALESCE(u.registered_at, al.created_at),
    updated_at           = now()
FROM activity_logs AS al
JOIN commercials AS c ON c.user_id = al.user_id AND c.agency_id IS NOT NULL AND c.deleted_at IS NULL
WHERE al.action = 'converted'
  AND al.entity_type = 'prospect'
  AND u.id::text = (al.new_values ->> 'client_id')
  AND u.registered_agency_id IS NULL;
