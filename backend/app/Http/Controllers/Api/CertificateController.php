<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Enrollment;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CertificateController extends Controller
{
    public function __construct(
        private readonly ScopeService $scopeService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Certificate::with([
            'enrollment' => fn ($q) => $q->with([
                'session' => fn ($sq) => $sq->with('course:id,name'),
                'learner:id,first_name,last_name,email',
            ]),
            'creator:id,first_name,last_name',
        ]);

        if ($request->filled('status')) {
            $query->ofStatus($request->input('status'));
        }

        if ($request->filled('agency_id')) {
            $query->whereHas('enrollment.session', fn ($q) => $q->where('agency_id', $request->input('agency_id')));
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('number', 'like', "%{$s}%")
                    ->orWhere('mention', 'like', "%{$s}%")
                    ->orWhereHas('enrollment.learner', function ($lq) use ($s) {
                        $lq->where('first_name', 'like', "%{$s}%")
                            ->orWhere('last_name', 'like', "%{$s}%");
                    });
            });
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $certificates = $query->orderByDesc('issued_on')->paginate($perPage);

        return response()->json($certificates);
    }

    public function show(Certificate $certificate): JsonResponse
    {
        $certificate->load([
            'enrollment' => fn ($q) => $q->with([
                'session' => fn ($sq) => $sq->with('course:id,name'),
                'learner:id,first_name,last_name,email',
            ]),
            'creator:id,first_name,last_name',
        ]);

        return response()->json($certificate);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enrollment_id' => ['required', 'uuid', 'exists:enrollments,id'],
            'mention' => ['nullable', 'string', 'max:100'],
        ]);

        $exists = Certificate::where('enrollment_id', $data['enrollment_id'])->exists();
        if ($exists) {
            return response()->json(['message' => 'Un certificat existe déjà pour cette inscription.'], 409);
        }

        $certificate = Certificate::create([
            'enrollment_id' => $data['enrollment_id'],
            'number' => Certificate::generateNextNumber(),
            'issued_on' => now()->toDateString(),
            'mention' => $data['mention'] ?? null,
            'status' => Certificate::STATUS_ISSUED,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(
            $certificate->fresh()->load([
                'enrollment' => fn ($q) => $q->with([
                    'session' => fn ($sq) => $sq->with('course:id,name'),
                    'learner:id,first_name,last_name,email',
                ]),
                'creator:id,first_name,last_name',
            ]),
            201
        );
    }

    public function revoke(Request $request, Certificate $certificate): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $certificate->update([
            'status' => Certificate::STATUS_REVOKED,
            'revoked_reason' => $data['reason'],
        ]);

        return response()->json(
            $certificate->fresh()->load([
                'enrollment' => fn ($q) => $q->with([
                    'session' => fn ($sq) => $sq->with('course:id,name'),
                    'learner:id,first_name,last_name,email',
                ]),
                'creator:id,first_name,last_name',
            ])
        );
    }
}
