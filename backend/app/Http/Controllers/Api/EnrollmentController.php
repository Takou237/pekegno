<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreEnrollmentRequest;
use App\Http\Requests\Api\UpdateEnrollmentRequest;
use App\Http\Resources\EnrollmentResource;
use App\Models\Enrollment;
use App\Models\TrainingSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class EnrollmentController extends Controller
{
    #[OA\Get(
        path: '/api/enrollments',
        summary: 'Lister les inscriptions avec filtres',
        tags: ['Académie — Inscriptions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'session_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['enrolled', 'completed', 'cancelled'])),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des inscriptions'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Enrollment::with(['session.course', 'learner'])
            ->when($request->session_id, fn ($q, $v) => $q->where('session_id', $v))
            ->when($request->status, fn ($q, $v) => $q->where('status', $v))
            ->when($request->learner_user_id, fn ($q, $v) => $q->where('learner_user_id', $v))
            ->when($request->agency_id, fn ($q, $v) => $q->whereHas(
                'session',
                fn ($sq) => $sq->where('agency_id', $v)
            ));

        return EnrollmentResource::collection(
            $query->orderByDesc('created_at')
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    #[OA\Post(
        path: '/api/enrollments',
        summary: 'Inscrire un client à une session (avec contrôle des capacités)',
        tags: ['Académie — Inscriptions'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Inscription créée'),
            new OA\Response(response: 409, description: 'Client déjà inscrit ou session complète'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreEnrollmentRequest $request): JsonResponse
    {
        $data = $request->validated();

        $exists = Enrollment::where('session_id', $data['session_id'])
            ->where('learner_user_id', $data['learner_user_id'])
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'Ce client est déjà inscrit à cette session.'], 409);
        }

        $session = TrainingSession::findOrFail($data['session_id']);

        if ($session->isFull()) {
            return response()->json(['message' => 'La session a atteint sa capacité maximale.'], 409);
        }

        $enrollment = Enrollment::create($data + ['status' => 'enrolled']);

        return (new EnrollmentResource($enrollment->load(['session.course', 'learner'])))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/enrollments/{enrollment}',
        summary: 'Afficher une inscription',
        tags: ['Académie — Inscriptions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'enrollment', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de l\'inscription'),
            new OA\Response(response: 404, description: 'Inscription non trouvée'),
        ]
    )]
    public function show(Enrollment $enrollment): EnrollmentResource
    {
        return new EnrollmentResource($enrollment->load(['session.course', 'learner']));
    }

    #[OA\Put(
        path: '/api/enrollments/{enrollment}',
        summary: 'Modifier une inscription (statut, présence)',
        tags: ['Académie — Inscriptions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'enrollment', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Inscription modifiée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdateEnrollmentRequest $request, Enrollment $enrollment): EnrollmentResource
    {
        $data = $request->validated();

        if (array_key_exists('attendance', $data)) {
            $data['attended_at'] = $data['attendance'] ? now() : null;
        }

        $enrollment->update($data);

        return new EnrollmentResource($enrollment->fresh()->load(['session.course', 'learner']));
    }

    #[OA\Delete(
        path: '/api/enrollments/{enrollment}',
        summary: 'Supprimer une inscription',
        tags: ['Académie — Inscriptions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'enrollment', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Inscription supprimée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Enrollment $enrollment): JsonResponse
    {
        $enrollment->delete();

        return response()->json(null, 204);
    }
}