<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\TrainingSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AttendanceController extends Controller
{
    public function index(TrainingSession $session): JsonResponse
    {
        $attendances = Attendance::ofSession($session->id)
            ->with([
                'enrollment' => fn ($q) => $q->with('learner:id,first_name,last_name,email'),
                'recorder:id,first_name,last_name',
            ])
            ->get();

        return response()->json([
            'training_session_id' => $session->id,
            'attendances' => $attendances,
        ]);
    }

    public function bulkUpdate(Request $request, TrainingSession $session): JsonResponse
    {
        $data = $request->validate([
            'attendances' => ['required', 'array', 'min:1'],
            'attendances.*.enrollment_id' => ['required', 'uuid', 'exists:enrollments,id'],
            'attendances.*.status' => ['required', 'string', 'in:present,absent,late,excused'],
        ]);

        $user = $request->user();

        DB::transaction(function () use ($data, $session, $user) {
            foreach ($data['attendances'] as $item) {
                $attendance = Attendance::updateOrCreate(
                    [
                        'training_session_id' => $session->id,
                        'enrollment_id' => $item['enrollment_id'],
                    ],
                    [
                        'status' => $item['status'],
                        'recorded_by' => $user->id,
                        'recorded_at' => now(),
                    ]
                );

                $latestStatus = Attendance::where('enrollment_id', $item['enrollment_id'])
                    ->orderByDesc('recorded_at')
                    ->value('status');

                $enrollment = \App\Models\Enrollment::find($item['enrollment_id']);
                if ($enrollment) {
                    $enrollment->update([
                        'attendance' => in_array($latestStatus, [Attendance::STATUS_PRESENT, Attendance::STATUS_LATE], true),
                    ]);
                }
            }
        });

        $attendances = Attendance::ofSession($session->id)
            ->with([
                'enrollment' => fn ($q) => $q->with('learner:id,first_name,last_name,email'),
                'recorder:id,first_name,last_name',
            ])
            ->get();

        return response()->json([
            'training_session_id' => $session->id,
            'attendances' => $attendances,
        ]);
    }
}
