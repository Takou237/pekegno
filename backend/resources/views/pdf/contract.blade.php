<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat {{ $contract->number }}</title>
  <style>
    @page { margin: 32px 38px 60px 38px; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 11.5px; color: #1a1a2e; margin: 0; }
    .header { width: 100%; border-bottom: 3px solid #4F46E5; padding-bottom: 12px; margin-bottom: 18px; }
    .brand { font-size: 22px; font-weight: bold; color: #4F46E5; letter-spacing: 1px; }
    .muted { color: #777; }
    .small { font-size: 10px; }
    h1.title { text-align: center; font-size: 17px; color: #1a1a2e; margin: 6px 0 4px; letter-spacing: 1px; }
    .subtitle { text-align: center; color: #777; font-size: 11px; margin-bottom: 20px; }
    h2 { font-size: 12.5px; color: #4F46E5; margin: 20px 0 6px; text-transform: uppercase; }
    table.parties td { vertical-align: top; width: 50%; padding: 9px 12px; border: 1px solid #e5e7eb; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 6px; }
    table.items th { background: #f0f0f5; text-align: left; font-size: 10.5px; color: #555; padding: 6px; border: 1px solid #e5e7eb; }
    table.items td { padding: 6px; border: 1px solid #ececf2; }
    .right { text-align: right; }
    .total { font-size: 12.5px; font-weight: bold; color: #4F46E5; }
    .article { margin-top: 14px; }
    .article .head { font-weight: bold; color: #1a1a2e; }
    .article p { margin: 5px 0; text-align: justify; line-height: 1.5; }
    ul.clauses { margin: 4px 0 4px 18px; padding: 0; }
    ul.clauses li { margin: 3px 0; line-height: 1.45; }
    table.signatures td { width: 50%; padding-top: 42px; text-align: center; vertical-align: top; }
    .sign-box { border: 1px solid #e5e7eb; height: 90px; margin: 0 10px; }
    .cachet { margin-top: 6px; color: #999; font-size: 10px; }
    .footer { margin-top: 26px; border-top: 1px solid #eee; padding-top: 8px; text-align: center; color: #aaa; font-size: 9.5px; }
  </style>
</head>
<body>
  @php
    $agency = $contract->agency;
    $client = $contract->client;
    $billingLabels = [
      'one_shot' => 'Paiement unique',
      'monthly' => 'Mensuelle',
      'quarterly' => 'Trimestrielle',
      'yearly' => 'Annuelle',
    ];
    $statusLabels = [
      'draft' => 'Brouillon', 'pending' => 'En attente', 'active' => 'Actif',
      'due_soon' => 'Échéance proche', 'expired' => 'Expiré', 'suspended' => 'Suspendu',
      'terminated' => 'Résilié', 'renewed' => 'Renouvelé',
    ];
    $frequencyLabels = ['per_day' => 'par jour', 'per_week' => 'par semaine', 'per_month' => 'par mois', 'once' => 'ponctuel'];
    $lines = $contract->prestation?->actions ?? $contract->pack?->items ?? collect();
  @endphp

  <div class="header">
    <table width="100%">
      <tr>
        <td>
          <div class="brand">PEKEGNO</div>
          <div class="small muted">
            {{ $agency?->name }}@if ($agency?->code) — Code {{ $agency->code }}@endif<br>
            {{ $agency?->address }}@if ($agency?->city) {{ $agency->city }}@endif
            @if ($agency?->phone)<br>Tél. {{ $agency->phone }}@endif
            @if ($agency?->email) — {{ $agency->email }}@endif
          </div>
        </td>
        <td align="right" valign="top">
          <div style="font-size:15px;font-weight:bold;">{{ $contract->number }}</div>
          <div class="small muted">
            Émis le {{ $contract->created_at?->format('d/m/Y') }}<br>
            Statut : {{ $statusLabels[$contract->status] ?? $contract->status }}
          </div>
        </td>
      </tr>
    </table>
  </div>

  <h1 class="title">CONTRAT DE PRESTATION DE SERVICES</h1>
  <div class="subtitle">Réf. {{ $contract->number }} — {{ $agency?->name }}</div>

  <h2>Entre les soussignés</h2>
  <table class="parties" width="100%" cellspacing="0">
    <tr>
      <td>
        <strong>Le Prestataire</strong><br>
        Pekegno — {{ $agency?->name }}@if ($agency?->code) ({{ $agency->code }})@endif<br>
        {{ $agency?->address }}@if ($agency?->city) {{ $agency->city }}@endif<br>
        @if ($agency?->phone)Tél. : {{ $agency->phone }}<br>@endif
        @if ($agency?->email)E-mail : {{ $agency->email }}@endif
      </td>
      <td>
        <strong>Le Client</strong><br>
        {{ $client?->first_name }} {{ $client?->last_name }}<br>
        @if ($contract->company){{ $contract->company->name }}<br>@endif
        {{ $client?->address }}@if ($client?->city) {{ $client->city }}@endif<br>
        @if ($client?->phone)Tél. : {{ $client->phone }}<br>@endif
        @if ($client?->email)E-mail : {{ $client->email }}@endif
      </td>
    </tr>
  </table>

  <h2>Articles</h2>

  <div class="article">
    <span class="head">Article 1 — Objet</span>
    <p>
      Le présent contrat a pour objet la fourniture, par le Prestataire au Client, des prestations de
      services suivantes :
      @if ($contract->prestation)
        <strong>{{ $contract->prestation->name }}</strong>
        @if ($contract->prestation->reference)(réf. {{ $contract->prestation->reference }})@endif.
        {!! $contract->prestation->description ? e($contract->prestation->description) : '' !!}
      @elseif ($contract->pack)
        <strong>{{ $contract->pack->name }}</strong>@if ($contract->pack->tagline) — {{ $contract->pack->tagline }}@endif.
        {!! $contract->pack->description ? e($contract->pack->description) : '' !!}
      @else
        <strong>Contrat de service</strong> établi entre les parties.
      @endif
    </p>
  </div>

  <div class="article">
    <span class="head">Article 2 — Durée</span>
    <p>
      Le présent contrat est conclu pour la période du
      <strong>{{ $contract->start_date?->format('d/m/Y') }}</strong> au
      <strong>{{ $contract->end_date?->format('d/m/Y') }}</strong>.
      Il prend effet au premier paiement validé par le Prestataire.
      @if ($contract->auto_renew)
        Il est renouvelé automatiquement à son échéance, sauf dénonciation par l'une des parties
        au moins trente (30) jours avant le terme.
      @else
        Il prendra fin de plein droit à son terme, sauf renouvellement exprès convenu entre les parties.
      @endif
    </p>
  </div>

  @if ($lines->isNotEmpty())
    <div class="article">
      <span class="head">Article 3 — Contenu des prestations</span>
      <table class="items">
        <thead>
          <tr><th>Désignation</th><th>Quantité</th><th>Fréquence</th></tr>
        </thead>
        <tbody>
          @foreach ($lines as $line)
            <tr>
              <td>{{ $line->title ?? $line->label }}</td>
              <td>{{ $line->quantity ?? '—' }} {{ $line->unit }}</td>
              <td>{{ $frequencyLabels[$line->frequency] ?? '—' }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>
  @endif

  <div class="article">
    <span class="head">Article {{ $lines->isNotEmpty() ? 4 : 3 }} — Prix et modalités de facturation</span>
    <table class="items">
      <tr>
        <td>Montant du contrat</td>
        <td class="right total">{{ number_format((float) $contract->amount, 0, ',', ' ') }} FCFA</td>
      </tr>
      @if ($contract->budget_allocated !== null)
        <tr>
          <td>Budget alloué (géré pour le Client)</td>
          <td class="right">{{ number_format((float) $contract->budget_allocated, 0, ',', ' ') }} FCFA</td>
        </tr>
      @endif
      <tr>
        <td>Cycle de facturation</td>
        <td class="right">{{ $billingLabels[$contract->billing_cycle] ?? $contract->billing_cycle }}</td>
      </tr>
      <tr>
        <td>Renouvellement automatique</td>
        <td class="right">{{ $contract->auto_renew ? 'Oui' : 'Non' }}</td>
      </tr>
    </table>
    <p>
      Les sommes dues sont payables selon le cycle de facturation ci-dessus. Éventuellement, le budget
      publicitaire géré pour le compte du Client est distinct des honoraires du Prestataire et fait
      l'objet d'une comptabilisation séparée.
    </p>
  </div>

  <div class="article">
    <span class="head">Article {{ $lines->isNotEmpty() ? 5 : 4 }} — Obligations des parties</span>
    <ul class="clauses">
      <li>Le Prestataire s'engage à exécuter les prestations avec diligence et professionnalisme, dans le respect de la réglementation applicable.</li>
      <li>Le Client s'engage à fournir dans les délais les informations, accès et éléments nécessaires à la bonne exécution des prestations.</li>
      <li>Le Client s'engage à régler les sommes dues selon les modalités définies à l'article précédent.</li>
      <li>Les parties s'engagent à préserver la confidentialité des informations échangées dans le cadre du présent contrat.</li>
    </ul>
  </div>

  <div class="article">
    <span class="head">Article {{ $lines->isNotEmpty() ? 6 : 5 }} — Résiliation</span>
    <p>
      Chaque partie peut résilier le présent contrat en cas de manquement grave de l'autre partie,
      après mise en demeure restée sans effet pendant quinze (15) jours. La résiliation prend effet
      à la date de notification et n'exonère pas le Client du paiement des prestations déjà exécutées.
    </p>
  </div>

  <div class="article">
    <span class="head">Article {{ $lines->isNotEmpty() ? 7 : 6 }} — Droit applicable et litiges</span>
    <p>
      Le présent contrat est régi par le droit en vigueur au lieu d'exécution des prestations.
      En cas de différend, les parties s'efforceront de trouver une solution amiable. À défaut,
      le litige sera soumis aux juridictions compétentes du ressort du Prestataire.
    </p>
  </div>

  <p class="muted small" style="margin-top:16px;">
    Fait en deux (2) exemplaires originaux, dont un remis à chaque partie.
    @if ($contract->commercial)
      <br>Commercial : {{ $contract->commercial->first_name }} {{ $contract->commercial->last_name }}.
    @endif
  </p>

  <table class="signatures" width="100%">
    <tr>
      <td>
        <strong>Pour le Prestataire</strong> — {{ $agency?->name }}
        <div class="sign-box"></div>
        <div class="cachet">Nom, qualité, signature et cachet</div>
      </td>
      <td>
        <strong>Pour le Client</strong> — {{ $client?->first_name }} {{ $client?->last_name }}
        <div class="sign-box"></div>
        <div class="cachet">Nom, qualité et signature (« lu et approuvé »)</div>
      </td>
    </tr>
  </table>

  <div class="footer">
    Pekegno Management System — Contrat {{ $contract->number }} — Généré le {{ now()->format('d/m/Y') }}
  </div>
</body>
</html>
