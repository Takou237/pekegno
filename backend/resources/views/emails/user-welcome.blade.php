<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vos accès à PEKEGNO</title>
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
                Bienvenue{{ $user->first_name ? ', '.$user->first_name : '' }}
              </h2>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                Votre compte a été créé. Vous pouvez dès maintenant vous connecter à la plateforme
                avec les identifiants ci-dessous.
              </p>

              {{-- Identifiants --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border:1px solid #eee;border-radius:8px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #eee;">
                    <p style="margin:0 0 4px;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Identifiant</p>
                    <p style="margin:0;color:#1a1a2e;font-size:15px;font-weight:600;word-break:break-all;">{{ $user->email }}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #eee;">
                    <p style="margin:0 0 4px;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Nom d'utilisateur</p>
                    <p style="margin:0;color:#1a1a2e;font-size:15px;font-weight:600;word-break:break-all;">{{ $user->username }}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Mot de passe par défaut</p>
                    <p style="margin:0;color:#1a1a2e;font-size:15px;font-weight:600;word-break:break-all;">{{ $plainPassword }}</p>
                  </td>
                </tr>
              </table>

              @if ($user->role)
                <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                  Rôle attribué : <strong style="color:#1a1a2e;">{{ $user->role->name }}</strong>
                </p>
              @endif

              {{-- CTA Button --}}
              @if ($loginUrl)
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                  <tr>
                    <td style="background-color:#6C63FF;border-radius:8px;">
                      <a href="{{ $loginUrl }}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                        Se connecter
                      </a>
                    </td>
                  </tr>
                </table>
              @endif

              <p style="margin:0;color:#999;font-size:13px;line-height:1.5;">
                Par sécurité, changez ce mot de passe dès votre première connexion.
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
