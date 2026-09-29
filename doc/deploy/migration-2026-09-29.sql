-- Mise à jour production — corrections du 29/09/2026 (à importer APRÈS migration-2026-09-28.sql).
-- Compatible PostgreSQL 9.6. Importer via phpPgAdmin (onglet Importer). Rejouable sans erreur.

-- Facture imprimable : informations de l'entité par pays (en-tête, pied, comptes, cachet)
ALTER TABLE countries ADD COLUMN IF NOT EXISTS invoice_settings JSON NULL;

-- Cameroun : pré-rempli depuis le modèle « FACTURE PEKEGNO academy.docx »
-- (modifiable ensuite dans Pays → crayon ; le cachet s'y téléverse).
UPDATE countries SET invoice_settings = '{
  "company_name": "PEKEGNO Cameroun SARL",
  "header_lines": "Douala – Makepe Saint-Tropez\nP.O.BOX: WC2H 9JQ\nTelephone: +44 208 049 9545 / WhatsApp: +237 6 92 71 39 55\nE-mail: services@pekegnodigital.com\nSite web: www.pekegnodigital.com",
  "footer_lines": "MAKEPE Saint Tropez – Douala – PEKEGNO Cameroun Sarl\nNUI : MO82416997570A",
  "payment_accounts": [
    {"label": "Afrik Land First Bank", "details": "00104-09857241001-32", "holder": "Société PEKEGNO CAMEROUN SARL"},
    {"label": "Orange Money", "details": "Numéro : #150*47*875570*Montant#", "holder": "Pekegno Cameroun Sarl"},
    {"label": "Mobile Money", "details": "Numéro : *126*4*801831*Montant#", "holder": "Pekegno Cameroun Sarl"}
  ]
}'
WHERE code = 'CMR' AND invoice_settings IS NULL;

-- T4 : la caissière peut payer les commissions (déjà présent dans le script du 28/09, rejoué sans effet)
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'caissier' AND p.name = 'commissions.encaisser'
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Formations enregistrées avec un type hors nomenclature par un ancien seeder
UPDATE courses SET mode = 'in_person' WHERE mode IN ('presentiel', 'présentiel');
UPDATE courses SET mode = 'online' WHERE mode IN ('en_ligne', 'enligne', 'en ligne');

INSERT INTO migrations (migration, batch)
SELECT m, (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations)
FROM (VALUES ('2026_09_29_000001_grant_cashier_commission_payment'),
             ('2026_09_29_000002_add_invoice_settings_to_countries_table'),
             ('2026_09_29_000003_normalize_course_mode')) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = v.m);
