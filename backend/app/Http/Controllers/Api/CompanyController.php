<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class CompanyController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    #[OA\Get(
        path: '/api/companies',
        summary: 'Lister les entreprises (filtres + pagination)',
        tags: ['Entreprises'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'industry', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Company::query()->withCount(['prospects', 'opportunities']);

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%")
                    ->orWhere('phone', 'like', "%{$s}%");
            });
        }

        if ($request->filled('industry')) {
            $query->where('industry', $request->input('industry'));
        }

        $companies = $query->orderBy('name')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($companies);
    }

    #[OA\Post(
        path: '/api/companies',
        summary: 'Créer une entreprise',
        tags: ['Entreprises'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Entreprise créée'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'industry' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'website' => ['nullable', 'url', 'max:150'],
        ]);

        $company = Company::create($data);

        $this->logger->log(
            action: 'created',
            entityType: 'company',
            entityId: $company->id,
            description: "Entreprise {$company->name} créée",
            newValues: $data,
            request: $request,
        );

        return response()->json($company, 201);
    }

    #[OA\Get(
        path: '/api/companies/{company}',
        summary: 'Détail d\'une entreprise',
        tags: ['Entreprises'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Détail'),
        ]
    )]
    public function show(Company $company): JsonResponse
    {
        $company->loadCount(['prospects', 'opportunities']);
        $company->load(['prospects' => fn ($q) => $q->limit(5), 'opportunities' => fn ($q) => $q->limit(5)]);

        return response()->json($company);
    }

    #[OA\Put(
        path: '/api/companies/{company}',
        summary: 'Modifier une entreprise',
        tags: ['Entreprises'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Entreprise modifiée'),
        ]
    )]
    public function update(Request $request, Company $company): JsonResponse
    {
        $oldValues = $company->only(['name', 'industry', 'phone', 'email', 'address', 'city', 'country', 'website']);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'industry' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'website' => ['nullable', 'url', 'max:150'],
        ]);

        $company->update($data);

        $this->logger->log(
            action: 'updated',
            entityType: 'company',
            entityId: $company->id,
            description: "Entreprise {$company->name} modifiée",
            oldValues: $oldValues,
            newValues: $company->only(array_keys($data)),
            request: $request,
        );

        return response()->json($company->fresh());
    }

    #[OA\Delete(
        path: '/api/companies/{company}',
        summary: 'Supprimer une entreprise',
        tags: ['Entreprises'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Supprimée'),
        ]
    )]
    public function destroy(Company $company): JsonResponse
    {
        $name = $company->name;
        $company->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'company',
            entityId: $company->id,
            description: "Entreprise {$name} supprimée",
        );

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/companies/search',
        summary: 'Rechercher une entreprise (autocomplete)',
        tags: ['Entreprises'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'q', in: 'query', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Résultats'),
        ]
    )]
    public function search(Request $request): JsonResponse
    {
        $q = $request->input('q', '');

        $companies = Company::where('name', 'like', "%{$q}%")
            ->limit(20)
            ->get(['id', 'name', 'industry', 'city']);

        return response()->json($companies);
    }
}
