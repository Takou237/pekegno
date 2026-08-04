<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreFormationRequest;
use App\Http\Requests\Api\UpdateFormationRequest;
use App\Http\Resources\FormationResource;
use App\Models\Formation;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class FormationController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(Formation::class, 'formation');
    }

    #[OA\Get(
        path: '/api/formations',
        summary: 'Lister les formations avec pagination et recherche',
        tags: ['Formations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom du service', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'category_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des formations'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Formation::with([
            'service' => fn ($q) => $q->with('category', 'agency', 'department'),
        ])->withCount('modules')
            ->whereHas('service', function ($q) use ($request) {
                $q->whereNull('deleted_at')
                    ->when($request->category_id, fn ($qb) => $qb->where('category_id', $request->category_id))
                    ->when($request->search, fn ($qb, $search) => $qb->where('name', 'like', "%{$search}%"));
            })
            ->orderBy('created_at', 'desc');

        $perPage = min((int) $request->input('per_page', 15), 100);

        return FormationResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/formations',
        summary: 'Créer une formation à partir d\'un service',
        tags: ['Formations'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['service_id', 'type'],
                properties: [
                    new OA\Property(property: 'service_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'type', type: 'string', enum: ['presentiel', 'distanciel']),
                    new OA\Property(property: 'duration', type: 'string', example: '6 semaines'),
                    new OA\Property(property: 'conditions', type: 'string'),
                    new OA\Property(property: 'deposit_amount', type: 'number'),
                    new OA\Property(property: 'installments_count', type: 'integer'),
                    new OA\Property(property: 'online_payment', type: 'boolean'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Formation créée', content: new OA\JsonContent(ref: '#/components/schemas/Formation')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreFormationRequest $request): JsonResponse
    {
        $data = $request->validated();
        $serviceId = $data['service_id'];
        unset($data['service_id']);

        if (Formation::find($serviceId)) {
            throw ValidationException::withMessages([
                'service_id' => 'Ce service est déjà configuré comme formation.',
            ]);
        }

        Service::findOrFail($serviceId);

        $formation = Formation::create(array_merge($data, ['id' => $serviceId]));

        return (new FormationResource($formation->load('service')))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/formations/{formation}',
        summary: 'Afficher une formation avec ses modules',
        tags: ['Formations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'formation', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de la formation'),
            new OA\Response(response: 404, description: 'Formation non trouvée'),
        ]
    )]
    public function show(Formation $formation): FormationResource
    {
        return new FormationResource($formation->load([
            'service' => fn ($q) => $q->with('category', 'agency', 'department', 'promotions'),
            'modules' => fn ($q) => $q->with('trainer'),
        ]));
    }

    #[OA\Put(
        path: '/api/formations/{formation}',
        summary: 'Modifier une formation',
        tags: ['Formations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'formation', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'type', type: 'string', enum: ['presentiel', 'distanciel']),
                    new OA\Property(property: 'duration', type: 'string'),
                    new OA\Property(property: 'conditions', type: 'string'),
                    new OA\Property(property: 'deposit_amount', type: 'number'),
                    new OA\Property(property: 'installments_count', type: 'integer'),
                    new OA\Property(property: 'online_payment', type: 'boolean'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Formation modifiée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 404, description: 'Formation non trouvée'),
        ]
    )]
    public function update(UpdateFormationRequest $request, Formation $formation): FormationResource
    {
        $formation->update($request->validated());

        return new FormationResource($formation->fresh()->load([
            'service' => fn ($q) => $q->with('category', 'agency', 'department', 'promotions'),
            'modules' => fn ($q) => $q->with('trainer'),
        ]));
    }

    #[OA\Delete(
        path: '/api/formations/{formation}',
        summary: 'Supprimer une formation et ses modules (le service reste)',
        tags: ['Formations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'formation', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Formation supprimée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Formation $formation): JsonResponse
    {
        $formation->modules()->delete();
        $formation->delete();

        return response()->json(null, 204);
    }
}
