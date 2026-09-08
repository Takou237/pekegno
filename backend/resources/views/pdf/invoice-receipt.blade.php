<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture {{ $invoice->number }}</title>
  <style>
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 12px; color: #1a1a2e; margin: 0; }
    .header { width: 100%; border-bottom: 3px solid #4F46E5; padding-bottom: 14px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: bold; color: #4F46E5; }
    .muted { color: #777; }
    .title { font-size: 18px; font-weight: bold; margin: 24px 0 4px; }
    .agency { margin-top: 6px; font-size: 11px; color: #555; line-height: 1.6; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 12px; }
    table.items th { background: #f0f0f5; text-align: left; font-size: 11px; text-transform: uppercase; color: #555; padding: 8px; }
    table.items td { padding: 8px; border-bottom: 1px solid #eee; }
    table.items th.right, table.items td.right { text-align: right; }
    table.items td.center { text-align: center; }
    .summary { width: 100%; margin-top: 16px; }
    .summary td { padding: 4px 8px; }
    .summary .label { color: #777; }
    .summary .value { text-align: right; font-weight: bold; }
    .summary .total td { border-top: 2px solid #4F46E5; font-size: 14px; }
    .summary .total .value { color: #4F46E5; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: bold; }
    .badge.pending { background: #fff7ed; color: #c2410c; }
    .badge.validated { background: #ecfdf5; color: #047857; }
    .badge.rejected { background: #fef2f2; color: #b91c1c; }
    .badge.paid { background: #eef2ff; color: #4338ca; }
    .badge.unpaid { background: #fef9c3; color: #a16207; }
    .badge.partial { background: #eff6ff; color: #1d4ed8; }
    .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 12px; text-align: center; color: #aaa; font-size: 10px; }
    .box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; margin-top: 12px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <table width="100%">
      <tr>
        <td>
          <div class="brand">PEKEGNO</div>
          <div class="muted">Reçu de facture</div>
        </td>
        <td align="right">
          <div style="font-size:16px;font-weight:bold;">{{ $invoice->number }}</div>
          <div class="muted">{{ $invoice->invoice_date ? $invoice->invoice_date->format('d/m/Y') : now()->format('d/m/Y') }}</div>
        </td>
      </tr>
    </table>
  </div>

  @if ($invoice->agency)
    <div class="agency">
      <strong>{{ $invoice->agency->name }}</strong><br>
      {{ $invoice->agency->address }}<br>
      {{ $invoice->agency->city }} — {{ $invoice->agency->phone }}
    </div>
  @endif

  <div class="title">État de la facture</div>
  @php
    $valLabels = ['pending' => 'En attente de validation', 'validated' => 'Validée', 'rejected' => 'Rejetée'];
    $valClass = $invoice->validation_status ?? 'pending';
  @endphp
  <table width="100%">
    <tr>
      <td class="muted">Validation</td>
      <td><span class="badge {{ $valClass }}">{{ $valLabels[$valClass] ?? $valClass }}</span></td>
      <td class="muted">Statut du paiement</td>
      <td><span class="badge {{ $invoice->status }}">{{ ucfirst($invoice->status) }}</span></td>
    </tr>
    @if ($invoice->validation_status === 'rejected' && $invoice->rejection_reason)
      <tr>
        <td colspan="4" style="padding-top:8px;"><div class="box"><strong>Motif du rejet :</strong> {{ $invoice->rejection_reason }}</div></td>
      </tr>
    @endif
  </table>

  <div class="title">Détail des articles</div>
  <table class="items">
    <thead>
      <tr>
        <th>Désignation</th>
        <th class="center">Quantité</th>
        <th class="right">Prix unitaire</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      @forelse ($invoice->items as $item)
        <tr>
          <td>{{ $item->label }}</td>
          <td class="center">{{ $item->quantity }}</td>
          <td class="right">{{ number_format((float) $item->unit_price, 0, ',', ' ') }} FCFA</td>
          <td class="right">{{ number_format((float) $item->line_total, 0, ',', ' ') }} FCFA</td>
        </tr>
      @empty
        <tr><td colspan="4" class="muted">Aucun article</td></tr>
      @endforelse
    </tbody>
  </table>

  <table class="summary">
    <tr>
      <td class="label">Sous-total</td>
      <td class="value">{{ number_format((float) ($invoice->total_amount + $invoice->discount - ($invoice->total_amount * $invoice->vat_rate / 100)), 0, ',', ' ') }} FCFA</td>
    </tr>
    @if ((float) $invoice->discount > 0)
      <tr>
        <td class="label">Remise</td>
        <td class="value">- {{ number_format((float) $invoice->discount, 0, ',', ' ') }} FCFA</td>
      </tr>
    @endif
    @if ((float) $invoice->vat_rate > 0)
      <tr>
        <td class="label">TVA ({{ $invoice->vat_rate }} %)</td>
        <td class="value">{{ number_format((float) $invoice->total_amount * $invoice->vat_rate / 100, 0, ',', ' ') }} FCFA</td>
      </tr>
    @endif
    <tr class="total">
      <td class="label">Total</td>
      <td class="value">{{ number_format((float) $invoice->total_amount, 0, ',', ' ') }} FCFA</td>
    </tr>
    <tr>
      <td class="label">Montant payé</td>
      <td class="value">{{ number_format((float) $invoice->amount_paid, 0, ',', ' ') }} FCFA</td>
    </tr>
    <tr>
      <td class="label">Reste à payer</td>
      <td class="value">{{ number_format((float) $invoice->balance_due, 0, ',', ' ') }} FCFA</td>
    </tr>
  </table>

  <div class="footer">
    Ce document a été généré automatiquement par PEKEGNO — Plateforme Multi-Agences SaaS.
    © {{ date('Y') }} PEKEGNO
  </div>
</body>
</html>