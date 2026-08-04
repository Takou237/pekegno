<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ReorderModulesRequest;
use App\Http\Requests\Api\StoreModuleRequest;
use App\Http\Requests\Api\UpdateModuleRequest;
use App\Http\Resources\ModuleResource;
use App\Models\Module;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class ModuleController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(Module::class, 'module');
    }

    #[OA\Get(
        path: '/api/modules',
        summary: 'Lister les modules d\'une formation',
        tags: ['Modules'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'formation_id', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste des modules'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Module::with('trainer')
            ->where('formation_id', $request->input('formation_id'))
            ->search($request->input('search'))
            ->orderBy('order');

        return ModuleResource::collection($query->get());
    }

    #[OA\Post(
        path: '/api/modules',
        summary: 'Créer un module de formation',
        tags: ['Modules'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['formation_id', 'name', 'type'],
                properties: [
                    new OA\Property(property: 'formation_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'trainer_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'order', type: 'integer'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'type', type: 'string', enum: ['video', 'pdf', 'cours', 'exercice', 'quiz']),
                    new OA\Property(property: 'cover_image', type: 'string'),
                    new OA\Property(property: 'video', type: 'string'),
                    new OA\Property(property: 'pdf', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Module créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreModuleRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (! isset($data['order'])) {
            $data['order'] = Module::where('formation_id', $data['formation_id'])->count();
        }

        $module = Module::create($data);

        return (new ModuleResource($module->load('trainer')))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/modules/{module}',
        summary: 'Afficher un module',
        tags: ['Modules'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'module', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du module'),
            new OA\Response(response: 404, description: 'Module non trouvé'),
        ]
    )]
    public function show(Module $module): ModuleResource
    {
        return new ModuleResource($module->load('trainer'));
    }

    #[OA\Put(
        path: '/api/modules/{module}',
        summary: 'Modifier un module',
        tags: ['Modules'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'module', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'trainer_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'order', type: 'integer'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'type', type: 'string'),
                    new OA\Property(property: 'cover_image', type: 'string'),
                    new OA\Property(property: 'video', type: 'string'),
                    new OA\Property(property: 'pdf', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Module modifié'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdateModuleRequest $request, Module $module): ModuleResource
    {
        $module->update($request->validated());

        return new ModuleResource($module->fresh()->load('trainer'));
    }

    #[OA\Delete(
        path: '/api/modules/{module}',
        summary: 'Supprimer un module',
        tags: ['Modules'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'module', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Module supprimé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Module $module): JsonResponse
    {
        $module->delete();

        return response()->json(null, 204);
    }

    #[OA\Post(
        path: '/api/modules/reorder',
        summary: 'Réordonner les modules d\'une formation',
        tags: ['Modules'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['order'],
                properties: [
                    new OA\Property(property: 'order', type: 'array', description: 'IDs des modules dans le nouvel ordre', items: new OA\Items(type: 'string', format: 'uuid')),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Modules réordonnés'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function reorder(ReorderModulesRequest $request): JsonResponse
    {
        $order = $request->validated('order');

        DB::transaction(function () use ($order) {
            foreach ($order as $index => $moduleId) {
                Module::where('id', $moduleId)->update(['order' => $index]);
            }
        });

        return response()->json(ModuleResource::collection(
            Module::whereIn('id', $order)->with('trainer')->orderBy('order')->get()
        ));
    }
}
