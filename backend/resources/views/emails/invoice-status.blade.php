<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Statut de votre facture</title>
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
              @if ($invoice->validation_status === \App\Models\Invoice::VALIDATION_VALIDATED)
                <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600;">
                  Votre facture a été validée
                </h2>
                <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                  Bonjour {{ $invoice->client?->first_name }}, votre preuve de paiement a été vérifiée et
                  votre facture <strong>{{ $invoice->number }}</strong> est désormais <strong>validée</strong>.
                </p>
              @else
                <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600;">
                  Votre facture a été rejetée
                </h2>
                <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                  Bonjour {{ $invoice->client?->first_name }}, votre preuve de paiement pour la facture
                  <strong>{{ $invoice->number }}</strong> n'a pas pu être validée.
                </p>
                @if ($invoice->rejection_reason)
                  <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0 0 4px;color:#991b1b;font-size:13px;font-weight:600;">Motif du rejet</p>
                    <p style="margin:0;color:#7f1d1d;font-size:15px;line-height:1.6;">{{ $invoice->rejection_reason }}</p>
                  </div>
                @endif
              @endif

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border-radius:8px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#555;">
                      <tr>
                        <td style="padding:4px 0;">Numéro de facture</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#1a1a2e;">{{ $invoice->number }}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">Montant</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#1a1a2e;">{{ number_format((float) $invoice->total_amount, 0, ',', ' ') }} FCFA</td>
                      </tr>
                      @if ($invoice->balance_due > 0)
                        <tr>
                          <td style="padding:4px 0;">Reste à payer</td>
                          <td style="padding:4px 0;text-align:right;font-weight:600;color:#1a1a2e;">{{ number_format((float) $invoice->balance_due, 0, ',', ' ') }} FCFA</td>
                        </tr>
                      @endif
                    </table>
                  </td>
                </tr>
              </table>

              @if ($invoice->validation_status === \App\Models\Invoice::VALIDATION_REJECTED)
                <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                  Vous pouvez soumettre une nouvelle preuve de paiement valide depuis votre espace client.
                </p>
              @endif

              @if ($clientUrl)
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
                  <tr>
                    <td style="background-color:#6C63FF;border-radius:8px;">
                      <a href="{{ $clientUrl }}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                        Voir mes factures
                      </a>
                    </td>
                  </tr>
                </table>
              @endif
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