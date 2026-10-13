<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Rapport commercial mensuel détaillé d'UN commercial (référence : le rapport
 * « M. JOEL — Septembre 2026 ») : KPI, synthèse par activité, répartition
 * géographique, évolution par semaine, analyse et annexe détaillée.
 *
 * Deux lignes de métier sont distinguées dans le rapport :
 * - « academy » : lignes de facture rattachées à un service ou un produit
 *   (formations, livres, Canva Pro, upgrades…) ;
 * - « agency » : lignes rattachées à un package ou une prestation.
 *
 * Montants :
 * - facturé = total des lignes des factures validées non annulées du commercial
 *   dont la date est dans la période ;
 * - encaissé = paiements validés encaissés dans la période sur ces factures,
 *   répartis proportionnellement sur chaque ligne de la facture ;
 * - reste = ligne facturée − part encaissée (jamais négatif localement).
 */
class CommercialMonthlyReportService
{
    /**
     * @return array<string, mixed>
     */
    public function detail(Commercial $commercial, Carbon $from, Carbon $to): array
    {
        $commercialData = [
            'id' => $commercial->id,
            'first_name' => $commercial->first_name,
            'last_name' => $commercial->last_name,
            'email' => $commercial->email,
            'agency_id' => $commercial->agency_id,
            'agency_name' => $commercial->agency?->name,
        ];

        // Bornes $from/$to en UTC pour les requêtes ; mais l'étiquette
        // affichée doit rester en jour métier (Africa/Douala), sinon un
        // from à 00:00 heure de Douala s'affiche la veille (ex. 30 sept.
        // au lieu du 1er oct.).
        $businessTz = (string) config('app.business_timezone', 'Africa/Douala');
        $period = [
            'from' => $from->copy()->setTimezone($businessTz)->toDateString(),
            'to' => $to->copy()->setTimezone($businessTz)->toDateString(),
        ];

        $invoices = Invoice::query()
            ->with(['items', 'client:id,first_name,last_name,email'])
            ->where('commercial_id', $commercial->id)
            ->whereNull('cancelled_at')
            ->validated()
            ->whereBetween('invoice_date', [$from, $to])
            ->get(['id', 'client_id', 'client_name', 'agency_id', 'invoice_date', 'total_amount', 'amount_paid']);

        if ($invoices->isEmpty()) {
            return $this->emptyReport($commercialData, $period);
        }

        $ids = $invoices->pluck('id');

        // Encaissé dans la période, par facture.
        $receivedByInvoice = InvoicePayment::query()
            ->whereIn('invoice_id', $ids)
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('invoice_id, sum(amount) as received')
            ->groupBy('invoice_id')
            ->get()
            ->keyBy('invoice_id');

        // Villes des clients puis des agences (repli) pour la géographie.
        $clientIds = $invoices->pluck('client_id')->filter()->unique();
        $clientCities = User::query()
            ->whereIn('id', $clientIds)
            ->pluck('city', 'id');

        $agencyIds = $invoices->pluck('agency_id')->filter()->unique();
        $agencyCities = Agency::query()
            ->whereIn('id', $agencyIds)
            ->pluck('city', 'id');

        $tabs = [
            'academy' => $this->newTab(),
            'agency' => $this->newTab(),
        ];

        $totals = [
            'lines' => 0,
            'clients' => 0,
            'billed' => 0.0,
            'received' => 0.0,
            'balance_due' => 0.0,
        ];

        foreach ($invoices as $invoice) {
            // Montant réellement facturé (après remise, TVA incluse) : c'est la
            // référence du rapport, pas la somme brute des lignes (line_total
            // ignore les remises → un faux « reste à recouvrer »).
            $total = (float) $invoice->total_amount;
            $received = (float) ($receivedByInvoice[$invoice->id]->received ?? 0);
            $items = $invoice->items->isNotEmpty()
                ? $invoice->items
                : $this->pseudoItem($invoice, $total);

            $linesTotal = (float) $items->sum('line_total');
            $itemsCount = $items->count();

            $city = $clientCities[$invoice->client_id] ?? $agencyCities[$invoice->agency_id] ?? null;
            $city = $city === null || $city === '' ? '—' : $city;

            $week = $this->weekOf($invoice->invoice_date);

            $clientKey = $invoice->client_id ?: ('name:'.($invoice->client_name ?? '—'));

            foreach ($items as $item) {
                $tabKey = ($item->package_id || $item->prestation_id) ? 'agency' : 'academy';
                $tab = &$tabs[$tabKey];

                $lineGross = (float) $item->line_total;
                if ($linesTotal > 0) {
                    $ratio = $lineGross / $linesTotal;
                    $lineBilled = $total * $ratio;
                    $allocated = $received * $ratio;
                } else {
                    $lineBilled = $itemsCount > 0 ? $total / $itemsCount : $total;
                    $allocated = $itemsCount > 0 ? $received / $itemsCount : 0.0;
                }
                $balance = max(0.0, $lineBilled - $allocated);

                $activity = ($item->label !== null && trim((string) $item->label) !== '')
                    ? trim((string) $item->label)
                    : '—';

                $tab['totals']['lines']++;
                $tab['totals']['billed'] += $lineBilled;
                $tab['totals']['received'] += $allocated;
                $tab['totals']['balance_due'] += $balance;
                $tab['clients'][$clientKey] = true;

                $this->bump($tab['by_activity'], $activity, $lineBilled, $allocated, $balance);
                $this->bump($tab['by_city'], $city, $lineBilled, $allocated, 0.0);

                $weekKey = $week['key'];
                $w = &$tab['by_week'][$weekKey];
                if (! isset($w)) {
                    $w = [
                        'key' => $weekKey,
                        'week' => $week['week'],
                        'start' => $week['start']->toDateString(),
                        'end' => $week['end']->toDateString(),
                        'lines' => 0,
                        'billed' => 0.0,
                        'received' => 0.0,
                    ];
                }
                $w['lines']++;
                $w['billed'] += $lineBilled;
                $w['received'] += $allocated;

                $tab['annexe'][] = [
                    'date' => Carbon::parse($invoice->invoice_date)->toDateString(),
                    'client' => $invoice->client_label ?? '—',
                    'city' => $city,
                    'activity' => $activity,
                    'total' => round($lineBilled, 2),
                    'paid' => round($allocated, 2),
                    'balance' => round($balance, 2),
                ];

                unset($tab);
            }
        }

        unset($w);

        foreach (['academy', 'agency'] as $key) {
            $tab = &$tabs[$key];

            $tab['totals']['balance_due'] = round($tab['totals']['balance_due'], 2);
            $tab['totals']['received'] = round($tab['totals']['received'], 2);
            $tab['totals']['billed'] = round($tab['totals']['billed'], 2);
            $tab['totals']['clients'] = count($tab['clients']);

            $tab['totals']['collection_rate'] = $tab['totals']['billed'] > 0
                ? round($tab['totals']['received'] / $tab['totals']['billed'] * 100, 1)
                : 0.0;

            $tab['by_activity'] = $this->finalizeBumps($tab['by_activity'], 'activity');
            $tab['by_city'] = $this->finalizeBumps($tab['by_city'], 'city', $tab['totals']['billed']);
            $tab['by_week'] = collect($tab['by_week'])
                ->sortBy(fn ($w) => $w['start'])
                ->values()
                ->map(fn ($w) => collect($w)->except('key')->all())
                ->all();
            $tab['annexe'] = $tab['annexe'];

            $totals['lines'] += $tab['totals']['lines'];
            $totals['clients'] += $tab['totals']['clients'];
            $totals['billed'] += $tab['totals']['billed'];
            $totals['received'] += $tab['totals']['received'];
            $totals['balance_due'] += $tab['totals']['balance_due'];

            $tab['clients'] = []; // non-sérialisable utile uniquement au comptage

            unset($tab);
        }

        $totals['billed'] = round($totals['billed'], 2);
        $totals['received'] = round($totals['received'], 2);
        $totals['balance_due'] = round($totals['balance_due'], 2);
        $totals['collection_rate'] = $totals['billed'] > 0
            ? round($totals['received'] / $totals['billed'] * 100, 1)
            : 0.0;

        return [
            'commercial' => $commercialData,
            'period' => $period,
            'totals' => $totals,
            'tabs' => [
                'academy' => $this->serializeTab($tabs['academy']),
                'agency' => $this->serializeTab($tabs['agency']),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function newTab(): array
    {
        return [
            'totals' => [
                'lines' => 0,
                'clients' => 0,
                'billed' => 0.0,
                'received' => 0.0,
                'balance_due' => 0.0,
                'collection_rate' => 0.0,
            ],
            'clients' => [],
            'by_activity' => [],
            'by_city' => [],
            'by_week' => [],
            'annexe' => [],
        ];
    }

    /**
     * Accumule une entrée (activité ou ville).
     *
     * @param  array<string, array<string, mixed>>  $bucket
     */
    private function bump(array &$bucket, string $label, float $billed, float $received, float $balance): void
    {
        if (! isset($bucket[$label])) {
            $bucket[$label] = [
                'lines' => 0,
                'billed' => 0.0,
                'received' => 0.0,
                'balance' => 0.0,
            ];
        }

        $bucket[$label]['lines']++;
        $bucket[$label]['billed'] += $billed;
        $bucket[$label]['received'] += $received;
        $bucket[$label]['balance'] += $balance;
    }

    /**
     * Tri des regroupements et arrondis. Pour les villes, on ajoute la part du
     * facturé du groupe par rapport au facturé total de l'onglet.
     *
     * @param  array<string, array<string, mixed>>  $bucket
     * @return array<int, array<string, mixed>>
     */
    private function finalizeBumps(array $bucket, string $nameKey, float $tabBilled = 0.0): array
    {
        return collect($bucket)
            ->map(function (array $row, string $key) use ($nameKey, $tabBilled): array {
                $row[$nameKey] = $key;
                $row['billed'] = round($row['billed'], 2);
                $row['received'] = round($row['received'], 2);
                $row['balance'] = round($row['balance'], 2);
                if ($nameKey === 'city') {
                    $row['share'] = $tabBilled > 0 ? round($row['billed'] / $tabBilled * 100, 1) : 0.0;
                }

                return $row;
            })
            ->sortByDesc('billed')
            ->values()
            ->all();
    }

    /**
     * Numéro de semaine dans le mois (1..5) et bornes réelles de la période.
     *
     * @return array{key: string, week: int, start: Carbon, end: Carbon}
     */
    private function weekOf(Carbon $date): array
    {
        $day = (int) $date->day;
        $week = (int) ceil($day / 7);

        $start = $date->copy()->startOfMonth()->addDays(($week - 1) * 7);
        $end = (clone $start)->addDays(6);
        if ($end->gt($date->copy()->endOfMonth())) {
            $end = $date->copy()->endOfMonth();
        }

        return [
            'key' => $date->format('Y-m')."-w{$week}",
            'week' => $week,
            'start' => $start,
            'end' => $end,
        ];
    }

    /**
     * Facture sans ligne : on synthétise une ligne au montant total de la facture.
     */
    private function pseudoItem(Invoice $invoice, float $total): Collection
    {
        return collect([
            (object) [
                'package_id' => null,
                'prestation_id' => null,
                'label' => $invoice->client_label ?? 'Vente',
                'line_total' => $total,
            ],
        ]);
    }

    /**
     * @param  array<string, mixed>  $commercialData
     * @param  array<string, string>  $period
     * @return array<string, mixed>
     */
    private function emptyReport(array $commercialData, array $period): array
    {
        return [
            'commercial' => $commercialData,
            'period' => $period,
            'totals' => [
                'lines' => 0,
                'clients' => 0,
                'billed' => 0.0,
                'received' => 0.0,
                'balance_due' => 0.0,
                'collection_rate' => 0.0,
            ],
            'tabs' => [
                'academy' => $this->serializeTab($this->newTab()),
                'agency' => $this->serializeTab($this->newTab()),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $tab
     * @return array<string, mixed>
     */
    private function serializeTab(array $tab): array
    {
        return [
            'totals' => $tab['totals'],
            'by_activity' => $tab['by_activity'],
            'by_city' => $tab['by_city'],
            'by_week' => $tab['by_week'],
            'annexe' => $tab['annexe'],
        ];
    }
}