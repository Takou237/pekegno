<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
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
        responses: [
            new OA\Response(response: 200, description: 'Fichier CSV'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function clients(Request $request): StreamedResponse
    {
        $query = User::whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->orderBy('last_name');

        if ($request->agency_id) {
            $query->whereHas('assignments', fn ($q) => $q->where('agencies.id', $request->agency_id));
        }

        $rows = $query->get()
            ->map(fn (User $c) => [
                $c->client_number ?? '',
                $c->first_name,
                $c->last_name,
                $c->email,
                $c->phone ?? '',
                $c->city ?? '',
                $c->country ?? '',
                $c->address ?? '',
                $c->is_active ? 'Actif' : 'Inactif',
                $c->created_at?->format('Y-m-d'),
            ]);

        return $this->stream(
            'clients.csv',
            ['N° client', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Ville', 'Pays', 'Adresse', 'Statut', 'Créé le'],
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
}
