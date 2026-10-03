<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat {{ $contract->number }}</title>
  <style>
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 12px; color: #1a1a2e; margin: 0; }
    .header { width: 100%; border-bottom: 3px solid #4F46E5; padding-bottom: 14px; margin-bottom: 20px; }
    .brand { font-size: 22px; font-weight: bold; color: #4F46E5; }
    .muted { color: #777; }
    h2 { font-size: 14px; color: #4F46E5; margin: 22px 0 8px; text-transform: uppercase; }
    table.parties td { vertical-align: top; width: 33%; padding: 8px; border: 1px solid #e5e7eb; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.items th { background: #f0f0f5; text-align: left; font-size: 11px; color: #555; padding: 6px; }
    table.items td { padding: 6px; border-bottom: 1px solid #eee; }
    .right { text-align: right; }
    .total { font-size: 14px; font-weight: bold; color: #4F46E5; }
    .signatures td { width: 50%; padding-top: 50px; text-align: center; }
    .footer { margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; text-align: center; color: #aaa; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <table width="100%">
      <tr>
        <td>
          <div class="brand">PEKEGNO</div>
          <div class="muted">Contrat de prestation — Pekegno Agency</div>
        </td>
        <td align="right">
          <div style="font-size:16px;font-weight:bold;">{{ $contract->number }}</div>
          <div class="muted">Émis le {{ $contract->created_at?->format('d/m/Y') }}</div>
        </td>
      </tr>
    </table>
  </div>

  <h2>Parties</h2>
  <table class="parties" width="100%" cellspacing="0">
    <tr>
      <td>
        <strong>Prestataire</strong><br>
        Pekegno — {{ $contract->agency?->name }}<br>
        {{ $contract->agency?->address }} {{ $contract->agency?->city }}<br>
        {{ $contract->agency?->phone }} {{ $contract->agency?->email }}
      </td>
      <td>
        <strong>Client</strong><br>
        {{ $contract->client?->first_name }} {{ $contract->client?->last_name }}<br>
        @if ($contract->company) {{ $contract->company->name }}<br> @endif
        {{ $contract->client?->email }}<br>
        {{ $contract->client?->phone }}
      </td>
      <td>
        <strong>Objet</strong><br>
        @if ($contract->prestation)
          Prestation {{ $contract->prestation->reference }}<br>
          {{ $contract->prestation->name }}
        @elseif ($contract->pack)
          Package {{ $contract->pack->name }}<br>
          {{ $contract->pack->tagline }}
        @else
          Contrat de service
        @endif
        @if ($contract->commercial)
          <br><span class="muted">Commercial : {{ $contract->commercial->first_name }} {{ $contract->commercial->last_name }}</span>
        @endif
      </td>
    </tr>
  </table>

  <h2>Période et budget</h2>
  <table class="items">
    <tr><td>Période</td><td class="right">du {{ $contract->start_date->format('d/m/Y') }} au {{ $contract->end_date->format('d/m/Y') }}</td></tr>
    <tr><td>Montant du contrat</td><td class="right total">{{ number_format((float) $contract->amount, 0, ',', ' ') }} FCFA</td></tr>
    @if ($contract->budget_allocated !== null)
      <tr><td>Budget alloué</td><td class="right">{{ number_format((float) $contract->budget_allocated, 0, ',', ' ') }} FCFA</td></tr>
    @endif
    <tr><td>Renouvellement automatique</td><td class="right">{{ $contract->auto_renew ? 'Oui' : 'Non' }}</td></tr>
  </table>

  @php($lines = $contract->prestation?->actions ?? $contract->pack?->items ?? collect())
  @if ($lines->isNotEmpty())
    <h2>Contenu</h2>
    <table class="items">
      <thead><tr><th>Élément</th><th>Quantité</th><th>Fréquence</th></tr></thead>
      <tbody>
        @foreach ($lines as $line)
          <tr>
            <td>{{ $line->title ?? $line->label }}</td>
            <td>{{ $line->quantity ?? '—' }} {{ $line->unit }}</td>
            <td>{{ ['per_day' => 'par jour', 'per_week' => 'par semaine', 'per_month' => 'par mois', 'once' => 'ponctuel'][$line->frequency] ?? '—' }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>
  @endif

  <p style="margin-top:20px;" class="muted">
    Le contrat prend effet au premier paiement validé. Le budget publicitaire éventuellement géré pour
    le client est distinct des honoraires de Pekegno.
  </p>

  <table class="signatures" width="100%">
    <tr>
      <td>Pour Pekegno<br><br>__________________________</td>
      <td>Le client<br><br>__________________________</td>
    </tr>
  </table>

  <div class="footer">Pekegno Management System — contrat {{ $contract->number }}</div>
</body>
</html>
