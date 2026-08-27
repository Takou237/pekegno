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
