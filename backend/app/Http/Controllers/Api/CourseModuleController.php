<?php

namespace App\Http\Controllers\Api;

use App\Models\Course;
use App\Models\CourseModule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class CourseModuleController extends Controller
{
    public function index(Request $request, Course $course): JsonResponse
    {
        $modules = $course->modules()->with('trainer')->get();

        // Formateur : s'il n'anime pas la session (ou aucune session de la
        // formation), il ne voit que les modules qui lui sont confiés — dans
        // cette session si `training_session_id` est donné.
        if ($request->user()?->role?->name === 'formateur') {
            $trainer = \App\Models\Trainer::forUser($request->user());
            $sessionId = $request->query('training_session_id');
            $animates = $trainer && $course->sessions()
                ->where('trainer_id', $trainer->id)
                ->when($sessionId, fn ($q) => $q->whereKey($sessionId))
                ->exists();
            if (! $animates) {
                $mine = $trainer ? \App\Models\SessionModuleTrainer::where('trainer_id', $trainer->id)
                    ->when($sessionId, fn ($q) => $q->where('training_session_id', $sessionId))
                    ->pluck('course_module_id')->all() : [];
                $modules = $modules->whereIn('id', $mine)->values();
            }
        }

        return response()->json($modules);
    }

    public function store(Request $request, Course $course): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'description' => 'nullable|string',
            'order_index' => 'nullable|integer|min:0',
            'duration_hours' => 'nullable|integer|min:1',
            'trainer_id' => 'nullable|exists:trainers,id',
        ]);

        $validated['course_id'] = $course->id;

        if (! isset($validated['order_index'])) {
            $validated['order_index'] = $course->modules()->max('order_index') + 1;
        }

        $module = CourseModule::create($validated);
        $module->load('trainer');

        return response()->json($module, 201);
    }

    public function show(Course $course, CourseModule $module): JsonResponse
    {
        $module->load('trainer', 'sessions');

        return response()->json($module);
    }

    public function update(Request $request, Course $course, CourseModule $module): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'description' => 'nullable|string',
            'order_index' => 'nullable|integer|min:0',
            'duration_hours' => 'nullable|integer|min:1',
            'trainer_id' => 'nullable|exists:trainers,id',
        ]);

        $module->update($validated);
        $module->load('trainer');

        return response()->json($module);
    }

    /** Formateurs des modules pour une session (un par module, facultatif). */
    public function sessionTrainers(\App\Models\TrainingSession $trainingSession): JsonResponse
    {
        $assigned = \App\Models\SessionModuleTrainer::with('trainer:id,first_name,last_name,email')
            ->where('training_session_id', $trainingSession->id)
            ->get()
            ->keyBy('course_module_id');

        return response()->json(CourseModule::where('course_id', $trainingSession->course_id)
            ->orderBy('order_index')
            ->get(['id', 'name', 'order_index'])
            ->map(fn (CourseModule $m) => [
                'course_module_id' => $m->id,
                'name' => $m->name,
                'trainer' => $assigned->get($m->id)?->trainer,
            ])->values());
    }

    public function updateSessionTrainers(Request $request, \App\Models\TrainingSession $trainingSession): JsonResponse
    {
        $data = $request->validate([
            'assignments' => 'present|array',
            'assignments.*.course_module_id' => 'required|uuid|exists:course_modules,id',
            'assignments.*.trainer_id' => 'nullable|uuid|exists:trainers,id',
        ]);

        $moduleIds = CourseModule::where('course_id', $trainingSession->course_id)->pluck('id')->all();

        \Illuminate\Support\Facades\DB::transaction(function () use ($data, $trainingSession, $moduleIds) {
            foreach ($data['assignments'] as $row) {
                abort_unless(in_array($row['course_module_id'], $moduleIds, true), 422, 'Ce module n\'appartient pas à la formation de la session.');
                $key = ['training_session_id' => $trainingSession->id, 'course_module_id' => $row['course_module_id']];
                if (empty($row['trainer_id'])) {
                    \App\Models\SessionModuleTrainer::where($key)->delete();
                } else {
                    \App\Models\SessionModuleTrainer::updateOrCreate($key, ['trainer_id' => $row['trainer_id']]);
                }
            }
        });

        return $this->sessionTrainers($trainingSession);
    }

    public function destroy(Course $course, CourseModule $module): JsonResponse
    {
        $module->delete();

        return response()->json(null, 204);
    }

    public function reorder(Request $request, Course $course): JsonResponse
    {
        $validated = $request->validate([
            'order' => 'required|array',
            'order.*' => 'exists:course_modules,id',
        ]);

        foreach ($validated['order'] as $index => $moduleId) {
            CourseModule::where('id', $moduleId)
                ->where('course_id', $course->id)
                ->update(['order_index' => $index]);
        }

        return response()->json($course->modules()->with('trainer')->get());
    }
}
