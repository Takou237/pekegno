<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
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
                return '"' . str_replace('"', '""', $value) . '"';
            }
            return $value;
        }, $fields)) . "\n";
    }

    private function stream(string $filename, array $header, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF" . $this->csvLine($header));
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
                $u->first_name . ' ' . $u->last_name,
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
}
