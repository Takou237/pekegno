<?php

namespace App\Http\Controllers\Api;

use App\Models\Course;
use App\Models\FormationEnrollment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class FormationEnrollmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = FormationEnrollment::with(['course', 'learner', 'invoice', 'seller']);

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->input('course_id'));
        }

        if ($request->filled('learner_user_id')) {
            $query->where('learner_user_id', $request->input('learner_user_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('agency_id')) {
            $query->whereHas('course', fn ($q) => $q->where('agency_id', $request->input('agency_id')));
        }

        $enrollments = $query->orderByDesc('enrolled_at')
            ->paginate($request->integer('per_page', 15));

        return response()->json($enrollments);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'learner_user_id' => 'required|exists:users,id',
            'invoice_id' => 'nullable|exists:invoices,id',
            'seller_user_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string',
        ]);

        $existing = FormationEnrollment::where('course_id', $validated['course_id'])
            ->where('learner_user_id', $validated['learner_user_id'])
            ->first();

        if ($existing) {
            return response()->json(['message' => 'L\'apprenant est déjà inscrit à cette formation.'], 409);
        }

        $validated['enrolled_at'] = now();
        $validated['status'] = 'enrolled';

        $enrollment = FormationEnrollment::create($validated);
        $enrollment->load(['course', 'learner']);

        return response()->json($enrollment, 201);
    }

    public function show(FormationEnrollment $formationEnrollment): JsonResponse
    {
        $formationEnrollment->load(['course.modules', 'learner', 'invoice', 'seller']);

        return response()->json($formationEnrollment);
    }

    public function update(Request $request, FormationEnrollment $formationEnrollment): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'sometimes|string|in:enrolled,completed,cancelled',
            'notes' => 'nullable|string',
            'invoice_id' => 'nullable|exists:invoices,id',
            'seller_user_id' => 'nullable|exists:users,id',
        ]);

        $formationEnrollment->update($validated);
        $formationEnrollment->load(['course', 'learner']);

        return response()->json($formationEnrollment);
    }

    public function destroy(FormationEnrollment $formationEnrollment): JsonResponse
    {
        $formationEnrollment->delete();

        return response()->json(null, 204);
    }

    /**
     * Liste des apprenants d'une formation avec leur progression.
     */
    public function learners(Request $request, Course $course): JsonResponse
    {
        $enrollments = FormationEnrollment::where('course_id', $course->id)
            ->with(['learner'])
            ->get()
            ->map(fn (FormationEnrollment $e) => [
                'id' => $e->id,
                'learner' => $e->learner,
                'status' => $e->status,
                'enrolled_at' => $e->enrolled_at,
                'seller' => $e->seller,
                'notes' => $e->notes,
            ]);

        return response()->json($enrollments);
    }
}
