<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\LearnerObservation;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ClientLearnerObservationController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    #[OA\Get(
        path: '/api/client/observations',
        summary: 'Lister les observations visibles du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des observations'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = LearnerObservation::with(['course:id,name', 'courseModule:id,name,order_index', 'author:id,first_name,last_name'])
            ->where('learner_user_id', $request->user()->id)
            ->where('visible_to_client', true);

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->input('course_id'));
        }

        $observations = $query->orderByDesc('created_at')
            ->paginate(min((int) $request->input('per_page', 20), 100));

        return response()->json($observations);
    }

    /**
     * Note personnelle : l'apprenant ajoute une observation sur sa propre fiche.
     * Elle est immédiatement visible par le client (auteur = apprenant).
     */
    #[OA\Post(
        path: '/api/client/observations',
        summary: 'Ajouter une note personnelle sur sa fiche',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Observation créée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'course_id' => ['nullable', 'exists:courses,id'],
            'course_module_id' => ['nullable', 'exists:course_modules,id'],
            'session_id' => ['nullable', 'exists:training_sessions,id'],
            'content' => ['required', 'string'],
        ]);

        $observation = LearnerObservation::create([
            'learner_user_id' => $request->user()->id,
            'course_id' => $validated['course_id'] ?? null,
            'course_module_id' => $validated['course_module_id'] ?? null,
            'session_id' => $validated['session_id'] ?? null,
            'author_user_id' => $request->user()->id,
            'visible_to_client' => true,
            'content' => $validated['content'],
        ]);

        $this->logger->log(
            action: 'created',
            entityType: 'learner_observation',
            entityId: $observation->id,
            description: "Note personnelle ajoutée par le client",
            request: $request,
        );

        return response()->json($observation->load(['course:id,name', 'courseModule:id,name', 'author:id,first_name,last_name']), 201);
    }
}
