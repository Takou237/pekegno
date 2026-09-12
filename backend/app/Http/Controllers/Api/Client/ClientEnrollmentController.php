<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\SessionParticipant;
use App\Models\TrainingSession;
use App\Services\ActivityLogger;
use App\Services\InvoiceNumberGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class ClientEnrollmentController extends Controller
{
    public function __construct(
        private readonly InvoiceNumberGenerator $invoiceNumber,
        private readonly ActivityLogger $logger,
    ) {}

    #[OA\Get(
        path: '/api/client/enrollments',
        summary: 'Lister les inscriptions (formations) du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des inscriptions'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $enrollments = FormationEnrollment::with([
                'course:id,name,code,mode,description,cover_image,duration_hours',
                'invoice:id,number,validation_status,status,total_amount,amount_paid',
                'sessionParticipants.session:id,course_id,start_at,status',
            ])
            ->where('learner_user_id', $request->user()->id)
            ->orderByDesc('enrolled_at')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($enrollments);
    }

    #[OA\Post(
        path: '/api/client/enrollments',
        summary: 'Le client s\'inscrit lui-même à une formation publiée sur le catalogue',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Inscription créée, facture en attente de validation'),
            new OA\Response(response: 409, description: 'Déjà inscrit'),
            new OA\Response(response: 422, description: 'Formation ou session invalide'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'course_id' => ['required', 'exists:courses,id'],
            'training_session_id' => ['nullable', 'exists:training_sessions,id'],
        ]);

        $course = Course::public()->find($validated['course_id']);

        if (! $course) {
            return response()->json([
                'message' => "Cette formation n'est plus disponible.",
            ], 422);
        }

        $user = $request->user();

        $existing = FormationEnrollment::where('course_id', $course->id)
            ->where('learner_user_id', $user->id)
            ->first();

        if ($existing && $existing->status !== 'cancelled') {
            return response()->json(['message' => 'Vous êtes déjà inscrit à cette formation.'], 409);
        }

        $requestedSessionId = $validated['training_session_id'] ?? null;

        if ($requestedSessionId) {
            $session = TrainingSession::find($requestedSessionId);

            if (! $session || $session->course_id !== $course->id) {
                return response()->json([
                    'message' => "La session sélectionnée n'appartient pas à cette formation.",
                    'errors' => ['training_session_id' => ['Session invalide pour cette formation.']],
                ], 422);
            }

            $participantCount = SessionParticipant::where('training_session_id', $session->id)
                ->where('status', 'enrolled')
                ->count();

            if ($session->max_capacity !== null && $participantCount >= $session->max_capacity) {
                return response()->json([
                    'message' => 'Cette session est complète, la capacité maximale est atteinte.',
                    'errors' => ['training_session_id' => ['Session complète.']],
                ], 422);
            }
        }

        $enrollment = DB::transaction(function () use ($course, $user, $existing, $requestedSessionId, $request) {
            $price = (float) $course->effective_price;
            $invoiceId = null;

            if ($price > 0) {
                $invoice = Invoice::create([
                    'number' => $this->invoiceNumber->next(),
                    'agency_id' => $course->agency_id,
                    'client_id' => $user->id,
                    'client_name' => trim("{$user->first_name} {$user->last_name}"),
                    'invoice_date' => now(),
                    'total_amount' => $price,
                    'amount_paid' => 0,
                    'discount' => 0,
                    'vat_rate' => 0,
                    'status' => 'unpaid',
                    'validation_status' => Invoice::VALIDATION_PENDING,
                    'source' => 'client_self',
                    'comment' => "Inscription en ligne à la formation {$course->name}",
                ]);

                $invoice->items()->create([
                    'label' => "Formation {$course->name} ({$course->code})",
                    'unit_price' => $price,
                    'quantity' => 1,
                    'line_total' => $price,
                ]);

                $this->logger->log(
                    action: 'created',
                    entityType: 'invoice',
                    entityId: $invoice->id,
                    description: "Facture {$invoice->number} générée pour l'inscription en ligne à la formation {$course->name}",
                    newValues: ['invoice' => $invoice->number, 'total_amount' => $price],
                    request: $request,
                );

                $invoiceId = $invoice->id;
            }

            if ($existing) {
                $existing->update([
                    'status' => 'enrolled',
                    'enrolled_at' => now(),
                    'invoice_id' => $invoiceId ?? $existing->invoice_id,
                ]);
                $enrollment = $existing;
            } else {
                $enrollment = FormationEnrollment::create([
                    'course_id' => $course->id,
                    'learner_user_id' => $user->id,
                    'invoice_id' => $invoiceId,
                    'enrolled_at' => now(),
                    'status' => 'enrolled',
                ]);
            }

            if ($requestedSessionId) {
                SessionParticipant::updateOrCreate(
                    [
                        'training_session_id' => $requestedSessionId,
                        'formation_enrollment_id' => $enrollment->id,
                    ],
                    ['status' => 'enrolled']
                );
            }

            return $enrollment->load(['course', 'invoice']);
        });

        return response()->json($enrollment, 201);
    }
}
