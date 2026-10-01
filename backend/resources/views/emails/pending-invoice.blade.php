<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture en attente de validation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  @php
    $currency = $invoice->agency?->geoCountry?->currency_code ?: 'FCFA';
    $seller = $invoice->commercial
        ? trim(($invoice->commercial->first_name ?? '').' '.($invoice->commercial->last_name ?? ''))
        : trim(($invoice->seller?->first_name ?? '').' '.($invoice->seller?->last_name ?? ''));
    $client = $invoice->client
        ? trim(($invoice->client->first_name ?? '').' '.($invoice->client->last_name ?? ''))
        : $invoice->client_name;
    $paymentLabels = ['cash' => 'Espèces', 'om' => 'Orange Money', 'momo' => 'MTN MoMo'];
  @endphp
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
                Nouvelle vente à valider
              </h2>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                Une vente vient d'être enregistrée{{ $seller !== '' ? ' par '.$seller : '' }}.
                La facture <strong>{{ $invoice->number }}</strong> est <strong>en attente de validation</strong> :
                vérifiez la preuve de paiement jointe puis validez-la ou rejetez-la.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border-radius:8px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#555;">
                      <tr>
                        <td style="padding:4px 0;">Numéro de facture</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#1a1a2e;">{{ $invoice->number }}</td>
                      </tr>
                      @if ($invoice->agency)
                        <tr>
                          <td style="padding:4px 0;">Agence</td>
                          <td style="padding:4px 0;text-align:right;font-weight:600;color:#1a1a2e;">{{ $invoice->agency->name }}</td>
                        </tr>
                      @endif
                      @if ($client)
                        <tr>
                          <td style="padding:4px 0;">Client</td>
                          <td style="padding:4px 0;text-align:right;font-weight:600;color:#1a1a2e;">{{ $client }}</td>
                        </tr>
                      @endif
                      @foreach ($invoice->items as $item)
                        <tr>
                          <td style="padding:4px 0;">{{ $item->label }} × {{ $item->quantity }}</td>
                          <td style="padding:4px 0;text-align:right;color:#1a1a2e;">{{ number_format((float) $item->line_total, 0, ',', ' ') }} {{ $currency }}</td>
                        </tr>
                      @endforeach
                      <tr>
                        <td style="padding:4px 0;">Montant total</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#1a1a2e;">{{ number_format((float) $invoice->total_amount, 0, ',', ' ') }} {{ $currency }}</td>
                      </tr>
                      @if ((float) $invoice->declared_advance > 0)
                        <tr>
                          <td style="padding:4px 0;">Avance déclarée</td>
                          <td style="padding:4px 0;text-align:right;font-weight:600;color:#1a1a2e;">{{ number_format((float) $invoice->declared_advance, 0, ',', ' ') }} {{ $currency }}</td>
                        </tr>
                      @endif
                      @if ($invoice->payment_type)
                        <tr>
                          <td style="padding:4px 0;">Mode de paiement</td>
                          <td style="padding:4px 0;text-align:right;font-weight:600;color:#1a1a2e;">
                            {{ $paymentLabels[$invoice->payment_type] ?? $invoice->payment_type }}{{ $invoice->payer_phone ? ' — '.$invoice->payer_phone : '' }}
                          </td>
                        </tr>
                      @endif
                    </table>
                  </td>
                </tr>
              </table>

              @if ($pendingUrl)
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
                  <tr>
                    <td style="background-color:#6C63FF;border-radius:8px;">
                      <a href="{{ $pendingUrl }}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                        Voir les factures en attente
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
