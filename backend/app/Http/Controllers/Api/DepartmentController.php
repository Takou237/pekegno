<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreDepartmentRequest;
use App\Http\Requests\Api\UpdateDepartmentRequest;
use App\Http\Resources\DepartmentResource;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class DepartmentController extends Controller
{
    private const ALLOWED_WITH = ['agency', 'assignedUsers'];

    private function parseWith(Request $request): array
    {
        $with = $request->input('with');
        if (!$with) return [];
        $relations = array_map('trim', explode(',', $with));
        return array_intersect($relations, self::ALLOWED_WITH);
    }

    #[OA\Get(
        path: '/api/departments',
        summary: 'Lister les départements avec pagination et recherche',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'agency_id', in: 'query', description: "Filtrer par agence", schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des départements'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $defaultWith = [
            'agency',
            'agency.assignedUsers' => fn ($q) => $q->wherePivot('is_primary', true),
            'chief',
        ];
        $query = Department::with($defaultWith)
            ->withCount('assignedUsers as user_count')
            ->when($request->search, function ($q, $search) {
                $q->where('name', 'like', "%{$search}%");
            })
            ->when($request->agency_id, function ($q, $agencyId) {
                $q->where('agency_id', $agencyId);
            })
            ->when($request->user()?->role?->name === 'responsable-agence', function ($q) use ($request) {
                $agencyIds = $request->user()->assignments()
                    ->where('is_primary', true)
                    ->pluck('agency_id');
                $q->whereIn('agency_id', $agencyIds);
            })
            ->when($request->user()?->role?->name === 'responsable-departement', function ($q) use ($request) {
                $deptIds = DB::table('department_chiefs')
                    ->where('user_id', $request->user()->id)
                    ->pluck('department_id');
                $q->whereIn('id', $deptIds);
            })
            ->orderBy('name');

        $perPage = min((int) $request->input('per_page', 15), 100);

        return DepartmentResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/departments',
        summary: 'Créer un département',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['agency_id', 'name'],
                properties: [
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'name', type: 'string', example: 'Service Commercial'),
                    new OA\Property(property: 'description', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Département créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreDepartmentRequest $request): JsonResponse
    {
        $department = Department::create($request->validated());

        return (new DepartmentResource($department->load('agency')))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/departments/{department}',
        summary: 'Afficher un département',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du département'),
            new OA\Response(response: 404, description: 'Département non trouvé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function show(Request $request, Department $department): DepartmentResource
    {
        $with = array_unique(array_merge(['agency', 'assignedUsers', 'chief'], $this->parseWith($request)));
        return new DepartmentResource($department->load($with));
    }

    #[OA\Put(
        path: '/api/departments/{department}',
        summary: 'Modifier un département',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'description', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Département modifié'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 404, description: 'Département non trouvé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdateDepartmentRequest $request, Department $department): DepartmentResource
    {
        $department->update($request->validated());

        return new DepartmentResource($department->fresh()->load('agency'));
    }

    #[OA\Delete(
        path: '/api/departments/{department}',
        summary: 'Supprimer un département',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Département supprimé'),
            new OA\Response(response: 409, description: 'Conflit - département a des utilisateurs assignés'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Department $department): JsonResponse
    {
        $department->assignedUsers()->detach();
        $department->delete();

        return response()->json(null, 204);
    }

    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = Department::onlyTrashed()->with('agency')
            ->when($request->search, function ($q, $search) {
                $q->where('name', 'like', "%{$search}%");
            })
            ->orderBy('deleted_at', 'desc');

        $perPage = min((int) $request->input('per_page', 15), 100);

        return DepartmentResource::collection($query->paginate($perPage));
    }

    public function restore(string $id): DepartmentResource
    {
        $this->authorize('restore', Department::class);

        $department = Department::onlyTrashed()->findOrFail($id);
        $department->restore();

        return new DepartmentResource($department->fresh()->load('agency'));
    }

    public function forceDelete(string $id): JsonResponse
    {
        $this->authorize('forceDelete', Department::class);

        $department = Department::onlyTrashed()->findOrFail($id);
        $department->forceDelete();

        return response()->json(null, 204);
    }
}
