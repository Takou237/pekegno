<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Period;
use App\Models\AccountingTransaction;
use App\Models\ActivityLog;
use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use App\Services\BilanService;
use App\Services\CommercialReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function __construct(
        private readonly BilanService $bilanService,
        private readonly CommercialReportService $commercialReportService,
    ) {}

    private function canExport(Request $request): bool
    {
        return in_array($request->user()?->role?->name, [
            'super-admin', 'direction-generale', 'responsable-agence',
        ]);
    }

    private function csvLine(array $fields): string
    {
        return implode(',', array_map(function ($value) {
            $value = (string) ($value ?? '');
            if (Str::contains($value, [',', '"', "\n", "\r"])) {
                return '"'.str_replace('"', '""', $value).'"';
            }

            return $value;
        }, $fields))."\n";
    }

    private function stream(string $filename, array $header, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF".$this->csvLine($header));
            foreach ($rows as $row) {
                fwrite($out, $this->csvLine($row));
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    #[OA\Get(
        path: '/api/exports/agencies',
        summary: 'Exporter les agences en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function agencies(Request $request): StreamedResponse
    {
        abort_unless($this->canExport($request), 403);

        $rows = Agency::query()
            ->orderBy('name')
            ->get(['name', 'code', 'country', 'city', 'address', 'phone', 'email'])
            ->map(fn (Agency $a) => [
                $a->name,
                $a->code,
                $a->country,
                $a->city,
                $a->address,
                $a->phone,
                $a->email,
            ]);

        return $this->stream(
            'agences.csv',
            ['Nom', 'Code', 'Pays', 'Ville', 'Adresse', 'Téléphone', 'Email'],
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/users',
        summary: 'Exporter les utilisateurs en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function users(Request $request): StreamedResponse
    {
        abort_unless($this->canExport($request), 403);

        $rows = User::query()
            ->with(['role', 'assignments'])
            ->orderBy('last_name')
            ->get()
            ->map(fn (User $u) => [
                $u->first_name.' '.$u->last_name,
                $u->username,
                $u->email,
                $u->phone,
                $u->role?->name ?? '',
                $u->is_active ? 'Actif' : 'Inactif',
                $u->assignments->pluck('name')->implode(', '),
            ]);

        return $this->stream(
            'utilisateurs.csv',
            ['Nom complet', 'Nom d\'utilisateur', 'Email', 'Téléphone', 'Rôle', 'Statut', 'Agences/Départements'],
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/services',
        summary: 'Exporter les services en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function services(Request $request): StreamedResponse
    {
        abort_unless($this->canExport($request), 403);

        $rows = Service::query()
            ->with('category', 'agency')
            ->orderBy('name')
            ->get()
            ->map(fn (Service $s) => [
                $s->name,
                $s->category?->name ?? '',
                $s->agency?->name ?? '',
                $s->price,
                $s->effective_price,
            ]);

        return $this->stream(
            'services.csv',
            ['Nom', 'Catégorie', 'Agence', 'Prix', 'Prix effectif'],
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/clients',
        summary: 'Exporter les clients en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['lead', 'learning', 'active', 'inactive', 'former'])),
            new OA\Parameter(name: 'client_category_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function clients(Request $request): StreamedResponse
    {
        $query = User::with(['clientCategory', 'geoCountry', 'geoCity', 'registeredAgency', 'referringCommercial'])
            ->whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->orderBy('last_name');

        $agencyIds = app(\App\Services\ScopeService::class)->agencyIds($request->user());

        if ($agencyIds !== null) {
            $query->where(function ($q) use ($agencyIds) {
                $q->whereIn('registered_agency_id', $agencyIds)
                    ->orWhereHas('clientInvoices', fn ($q) => $q->whereIn('agency_id', $agencyIds));
            });
        }

        if ($request->agency_id) {
            $query->where(function ($q) use ($request) {
                $q->where('registered_agency_id', $request->agency_id)
                    ->orWhereHas('clientInvoices', fn ($q) => $q->where('agency_id', $request->agency_id));
            });
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->client_category_id) {
            $query->where('client_category_id', $request->client_category_id);
        }

        if ($request->from) {
            $query->whereDate('registered_at', '>=', $request->from);
        }

        if ($request->to) {
            $query->whereDate('registered_at', '<=', $request->to);
        }

        $rows = $query->get()
            ->map(fn (User $c) => [
                $c->client_number ?? '',
                $c->first_name,
                $c->last_name,
                $c->email,
                $c->phone ?? '',
                $c->clientCategory?->name ?? '',
                $c->status,
                $c->geoCountry?->name ?? $c->country ?? '',
                $c->geoCity?->name ?? $c->city ?? '',
                $c->registeredAgency?->name ?? '',
                trim(($c->referringCommercial?->first_name ?? '').' '.($c->referringCommercial?->last_name ?? '')),
                $c->registered_at?->format('Y-m-d'),
                $c->address ?? '',
                $c->is_active ? 'Actif' : 'Inactif',
                $c->created_at?->format('Y-m-d'),
            ]);

        return $this->stream(
            'clients.csv',
            ['N° client', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Catégorie', 'Statut', 'Pays', 'Ville', 'Agence d\'enregistrement', 'Commercial référent', 'Enregistré le', 'Adresse', 'Compte', 'Créé le'],
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/commercials',
        summary: 'Exporter les commerciaux en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function commercials(Request $request): StreamedResponse
    {
        $rows = Commercial::query()
            ->with('agency', 'user')
            ->orderBy('last_name')
            ->get()
            ->map(fn (Commercial $c) => [
                $c->first_name,
                $c->last_name,
                $c->email,
                $c->phone ?? '',
                $c->agency?->name ?? '',
                $c->user?->username ?? '',
                $c->commission_type,
                $c->commission_value,
                $c->points_balance,
                $c->is_active ? 'Actif' : 'Inactif',
            ]);

        return $this->stream(
            'commerciaux.csv',
            ['Prénom', 'Nom', 'Email', 'Téléphone', 'Agence', 'Utilisateur lié', 'Type commission', 'Commission', 'Points', 'Statut'],
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/employees',
        summary: 'Exporter les employés en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function employees(Request $request): StreamedResponse
    {
        $rows = Commercial::query()
            ->with('agency', 'user')
            ->kind('employe')
            ->orderBy('last_name')
            ->get()
            ->map(fn (Commercial $c) => [
                $c->first_name,
                $c->last_name,
                $c->email,
                $c->phone ?? '',
                $c->agency?->name ?? '',
                $c->user?->username ?? '',
                $c->commission_type,
                $c->commission_value,
                $c->points_balance,
                $c->is_active ? 'Actif' : 'Inactif',
            ]);

        return $this->stream(
            'employes.csv',
            ['Prénom', 'Nom', 'Email', 'Téléphone', 'Agence', 'Utilisateur lié', 'Type commission', 'Commission', 'Points', 'Statut'],
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/invoices',
        summary: 'Exporter les factures en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function invoices(Request $request): StreamedResponse
    {
        $query = Invoice::query()
            ->with('client:id,first_name,last_name,client_number', 'commercial:id,first_name,last_name', 'agency:id,name')
            ->whereNull('cancelled_at');

        if ($request->from) {
            $query->whereDate('invoice_date', '>=', $request->from);
        }
        if ($request->to) {
            $query->whereDate('invoice_date', '<=', $request->to);
        }

        $rows = $query->orderByDesc('invoice_date')->get()
            ->map(fn (Invoice $i) => [
                $i->number,
                $i->invoice_date?->format('Y-m-d H:i'),
                $i->agency?->name ?? '',
                $i->client?->client_number ?? '',
                $i->client ? $i->client->first_name.' '.$i->client->last_name : '',
                $i->commercial?->first_name.' '.$i->commercial?->last_name ?? '',
                $i->total_amount,
                $i->amount_paid,
                $i->status,
                $i->payment_type ?? '',
            ]);

        return $this->stream(
            'factures.csv',
            ['N°', 'Date', 'Agence', 'N° client', 'Client', 'Commercial', 'Montant', 'Payé', 'Statut', 'Paiement'],
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/accounting',
        summary: 'Exporter les transactions comptables en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'type', in: 'query', schema: new OA\Schema(type: 'string', enum: ['income', 'expense'])),
            new OA\Parameter(name: 'category_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'client_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function accounting(Request $request): StreamedResponse
    {
        abort_unless($this->canExport($request), 403);

        $transactions = AccountingTransaction::query()
            ->with('agency:id,name', 'client:id,first_name,last_name', 'operator:id,first_name,last_name')
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->category_id, fn ($q, $id) => $q->where('category_id', $id))
            ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
            ->when($request->from, fn ($q, $d) => $q->whereDate('transacted_at', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->whereDate('transacted_at', '<=', $d))
            ->when($request->filled('search'), fn ($q) => $q->where(function ($q) use ($request) {
                $q->where('label', 'like', "%{$request->search}%")
                    ->orWhere('reference', 'like', "%{$request->search}%");
            }))
            ->orderByDesc('transacted_at')
            ->get();

        $rows = $transactions->map(fn (AccountingTransaction $t) => [
            $t->number,
            $t->agency?->name ?? '',
            $t->label,
            (float) $t->amount,
            $t->client_id ? trim(($t->client?->first_name ?? '').' '.($t->client?->last_name ?? '')) : '',
            $t->transacted_at?->format('Y-m-d H:i'),
            $t->type === 'income' ? 'Entrée' : 'Sortie',
            $t->operator_id ? trim(($t->operator?->first_name ?? '').' '.($t->operator?->last_name ?? '')) : '',
            $t->note ?? '',
            $t->beneficiary ?? '',
            $t->justification ?? '',
        ]);

        return $this->stream(
            'comptabilite-'.now()->format('Y-m-d').'.csv',
            ['N°', 'Agence', 'Rubrique', 'Montant', 'Client', 'Date', 'Type', 'Opérateur', 'Objet', 'Bénéficiaire', 'Justification'],
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/bilans',
        summary: 'Exporter le bilan du jour en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'country_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function dailyBilan(Request $request): StreamedResponse
    {
        $date = $request->date('date') ?? Carbon::today();
        $agencyId = $request->input('agency_id');
        $countryId = $request->input('country_id');

        $scope = app(\App\Services\ScopeService::class);
        $agencyIds = $scope->agencyIds($request->user());

        if ($countryId) {
            $countryAgencyIds = Agency::query()
                ->where('country_id', $countryId)
                ->whereNull('deleted_at')
                ->pluck('id');

            if ($agencyIds !== null) {
                $countryAgencyIds = $countryAgencyIds->intersect($agencyIds)->values();
            }

            $agencyIds = $countryAgencyIds->isEmpty() ? [] : $countryAgencyIds->all();
        }

        if ($agencyId) {
            if ($agencyIds !== null && ! in_array($agencyId, $agencyIds, true)) {
                abort(403, 'Cette agence est hors de votre périmètre.');
            }

            $bilan = $this->bilanService->daily($date, $agencyId);
            $rows = collect();

            foreach ($bilan['services_by_category'] as $s) {
                $rows->push([$s['category'], $s['label'], $s['count'], (float) $s['total']]);
            }
            $rows->push(['', 'TOTAL VENTES', (int) $bilan['total_ventes'], '']);
            $rows->push(['']);
            $rows->push(['Encaissements', 'Cash', '', (float) $bilan['cash_total']]);
            $rows->push(['Encaissements', 'Orange Money', '', (float) $bilan['om_total']]);
            $rows->push(['Encaissements', 'MTN Mobile Money', '', (float) $bilan['momo_total']]);
            $rows->push(['', 'TOTAL ENCAISSÉ', '', (float) $bilan['total_received']]);
            $rows->push(['']);
            $rows->push(['', 'Solde initial', '', abs((float) $bilan['solde_initial'])]);
            foreach ($bilan['expenses_by_category'] as $e) {
                $rows->push(['Dépense', $e['name'], '', (float) $e['total']]);
            }
            $rows->push(['', 'TOTAL DÉPENSES', '', (float) $bilan['expense_total']]);
            $rows->push(['', 'SOLDE FINAL', '', abs((float) $bilan['solde_final'])]);

            return $this->stream(
                'bilan-agence-'.$date->format('Y-m-d').'.csv',
                ['Type', 'Détail', 'Quantité', 'Montant'],
                $rows
            );
        }

        $consolidated = $this->bilanService->consolidated($date, $agencyIds);
        $rows = collect();
        $header = ['Agence', 'Total Ventes (FCFA)', 'Cash', 'Orange Money', 'MTN Mobile Money', 'Total Encaissé', 'Solde Initial', 'Dépenses', 'Solde Final'];
        $totalRow = [0, 0, 0, 0, 0, 0, 0, 0];

        foreach ($consolidated['agencies'] as $ab) {
            $rows->push([
                $ab['agency']['name'] ?? '—',
                $ab['total_ventes_amount'],
                $ab['cash_total'],
                $ab['om_total'],
                $ab['momo_total'],
                $ab['total_received'],
                abs($ab['solde_initial']),
                $ab['expense_total'],
                abs($ab['solde_final']),
            ]);
            $totalRow[0] += $ab['total_ventes_amount'];
            $totalRow[1] += $ab['cash_total'];
            $totalRow[2] += $ab['om_total'];
            $totalRow[3] += $ab['momo_total'];
            $totalRow[4] += $ab['total_received'];
            $totalRow[5] += abs($ab['solde_initial']);
            $totalRow[6] += $ab['expense_total'];
            $totalRow[7] += abs($ab['solde_final']);
        }

        $rows->push(['TOTAL GÉNÉRAL', $totalRow[0], $totalRow[1], $totalRow[2], $totalRow[3], $totalRow[4], $totalRow[5], $totalRow[6], $totalRow[7]]);
        $rows->push(['']);
        $rows->push(['DÉPENSES PAR CATÉGORIE (toutes agences)']);
        foreach ($consolidated['expenses_by_category'] as $e) {
            $rows->push([$e['name'], '', '', '', '', '', '', (float) $e['total'], '']);
        }

        return $this->stream(
            'bilan-global-'.$date->format('Y-m-d').'.csv',
            $header,
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/commercial-report',
        summary: 'Exporter le reporting commercial en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'commercial_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'kind', in: 'query', schema: new OA\Schema(type: 'string', enum: ['commercial', 'employe'])),
            new OA\Parameter(name: 'from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function commercialReport(Request $request): StreamedResponse
    {
        abort_unless($this->canExport($request), 403);

        $from = Period::from($request, Carbon::now()->startOfMonth());
        $to = Period::to($request);

        $report = $this->commercialReportService->report(
            agencyId: $request->input('agency_id'),
            commercialId: $request->input('commercial_id'),
            kind: $request->input('kind'),
            from: $from,
            to: $to,
        );

        $rows = collect($report['ranking'])->map(fn (array $row) => [
            trim(($row['first_name'] ?? '').' '.($row['last_name'] ?? '')),
            $row['agency_name'] ?? '',
            $row['kind'] === 'employe' ? 'Employé' : 'Commercial',
            $row['sales_count'],
            $row['revenue_billed'],
            $row['revenue_received'],
            $row['payments_count'],
            $row['commissions'],
            $row['points'],
            $row['prospects_count'],
            $row['clients_converted'],
            $row['conversion_rate'],
        ]);

        $t = $report['totals'];
        $rows->push([
            'TOTAL',
            '',
            '',
            $t['sales_count'],
            $t['revenue_billed'],
            $t['revenue_received'],
            $t['payments_count'],
            $t['commissions'],
            $t['points'],
            $t['prospects_count'],
            $t['clients_converted'],
            '',
        ]);

        return $this->stream(
            'reporting-commercial-'.$from->format('Y-m-d').'-'.$to->format('Y-m-d').'.csv',
            ['Commercial', 'Agence', 'Type', 'Ventes', 'CA facturé', 'CA encaissé', 'Tranches', 'Commissions', 'Points', 'Prospects', 'Clients convertis', 'Taux conversion %'],
            $rows
        );
    }

    #[OA\Get(
        path: '/api/exports/activity-logs',
        summary: 'Exporter le journal d\'activité en CSV',
        tags: ['Exports'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function activityLogs(Request $request): StreamedResponse
    {
        $query = ActivityLog::query()
            ->with('user:id,first_name,last_name,email', 'agency:id,name,code');

        if ($request->from) {
            $query->whereDate('created_at', '>=', $request->from);
        }
        if ($request->to) {
            $query->whereDate('created_at', '<=', $request->to);
        }

        $rows = $query->orderByDesc('created_at')->get()
            ->map(fn (ActivityLog $l) => [
                $l->created_at?->format('Y-m-d H:i:s'),
                $l->user ? $l->user->first_name.' '.$l->user->last_name : '',
                $l->user?->email ?? '',
                $l->agency?->name ?? '',
                $l->action,
                $l->entity_type,
                $l->entity_id ?? '',
                $l->description ?? '',
                $l->ip_address ?? '',
            ]);

        return $this->stream(
            'activite.csv',
            ['Date', 'Utilisateur', 'Email', 'Agence', 'Action', 'Entité', 'ID entité', 'Description', 'IP'],
            $rows
        );
    }
}
