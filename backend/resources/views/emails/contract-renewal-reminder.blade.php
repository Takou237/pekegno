<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Renouvellement de votre contrat</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#6C63FF,#4F46E5);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">PEKEGNO</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600;">
                Votre contrat arrive à échéance
              </h2>
              <p style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.6;">
                Bonjour {{ $contract->client?->first_name }}, votre contrat
                <strong>{{ $contract->number }}</strong>
                @if ($contract->pack) (« {{ $contract->pack->name }} ») @elseif ($contract->prestation) (« {{ $contract->prestation->name }} ») @endif
                se termine le <strong>{{ $contract->end_date->format('d/m/Y') }}</strong>,
                soit dans {{ $daysLeft }} jour(s).
              </p>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                Pour continuer à bénéficier de nos services sans interruption, contactez votre conseiller
                Pekegno ou rendez-vous dans votre espace client.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;background-color:#f9fafb;text-align:center;color:#999;font-size:12px;">
              © {{ date('Y') }} Pekegno — Ce message est envoyé automatiquement.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
