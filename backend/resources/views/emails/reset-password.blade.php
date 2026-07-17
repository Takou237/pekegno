<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation du mot de passe</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          {{-- Header --}}
          <tr>
            <td style="background:linear-gradient(135deg,#6C63FF,#4F46E5);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">PEKEGNO</h1>
            </td>
          </tr>

          {{-- Body --}}
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600;">
                Réinitialisation de votre mot de passe
              </h2>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                Vous avez demandé la réinitialisation de votre mot de passe.
                Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
              </p>

              {{-- CTA Button --}}
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#6C63FF;border-radius:8px;">
                    <a href="{{ $url }}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                      Réinitialiser mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#999;font-size:13px;line-height:1.5;">
                Ce lien expirera dans <strong>60 minutes</strong>.
              </p>
              <p style="margin:0;color:#999;font-size:13px;line-height:1.5;">
                Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
              </p>
            </td>
          </tr>

          {{-- Footer --}}
          <tr>
            <td style="background-color:#f8f9fa;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="margin:0;color:#aaa;font-size:12px;">
                © {{ date('Y') }} PEKEGNO — Plateforme Multi-Agences SaaS
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
