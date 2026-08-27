<?php

namespace App\Http\Controllers\Api;

use App\Models\LearnerObservation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class LearnerObservationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = LearnerObservation::with(['course', 'session']);

        if ($request->filled('learner_user_id')) {
            $query->where('learner_user_id', $request->input('learner_user_id'));
        }

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->input('course_id'));
        }

        if ($request->filled('session_id')) {
            $query->where('session_id', $request->input('session_id'));
        }

        $observations = $query->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15));

        return response()->json($observations);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'learner_user_id' => 'required|exists:users,id',
            'course_id' => 'nullable|exists:courses,id',
            'session_id' => 'nullable|exists:training_sessions,id',
            'content' => 'required|string',
        ]);

        $observation = LearnerObservation::create($validated);
        $observation->load(['course', 'session']);

        return response()->json($observation, 201);
    }

    public function destroy(LearnerObservation $learnerObservation): JsonResponse
    {
        $learnerObservation->delete();

        return response()->json(null, 204);
    }
}
