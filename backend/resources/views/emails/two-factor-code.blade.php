<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre code de vérification</title>
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
            <td style="padding:40px;text-align:center;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600;">
                Votre code de vérification
              </h2>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                Saisissez ce code à 6 chiffres pour terminer votre connexion.
              </p>

              <div style="background-color:#f8f9fa;border:1px solid #eee;border-radius:8px;padding:24px;margin:0 0 24px;">
                <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1a1a2e;">{{ $code }}</span>
              </div>

              <p style="margin:0;color:#999;font-size:13px;line-height:1.5;">
                Ce code expire dans {{ $expiresInMinutes }} minutes.
                Si vous n'êtes pas à l'origine de cette connexion, ignorez cet email
                et changez votre mot de passe.
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
