<?php

namespace App\Http\Controllers\Api;

use App\Models\Commercial;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\SessionParticipant;
use App\Models\Trainer;
use App\Models\TrainingSession;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\InvoiceNumberGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class FormationEnrollmentController extends Controller
{
    public function __construct(
        private readonly InvoiceNumberGenerator $invoiceNumber,
        private readonly ActivityLogger $logger,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = FormationEnrollment::with(['course' => fn ($q) => $q->withCount('sessions', 'modules'), 'learner', 'invoice', 'seller', 'sellerTrainer']);

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
            'seller_trainer_id' => 'nullable|exists:trainers,id|prohibits:seller_user_id',
            'notes' => 'nullable|string',
        ]);

        if (! User::whereKey($validated['learner_user_id'])->whereHas('role', fn ($q) => $q->where('name', 'client'))->exists()) {
            return response()->json([
                'message' => "Le bénéficiaire doit être un apprenant (client).",
                'errors' => ['learner_user_id' => ['Sélectionnez un apprenant valide.']],
            ], 422);
        }

        $existing = FormationEnrollment::where('course_id', $validated['course_id'])
            ->where('learner_user_id', $validated['learner_user_id'])
            ->first();

        if ($existing && $existing->status !== 'cancelled') {
            return response()->json(['message' => 'L\'apprenant est déjà inscrit à cette formation.'], 409);
        }

        $validated['enrolled_at'] = now();
        $validated['status'] = 'enrolled';

        $enrollment = DB::transaction(function () use ($validated, $request, $existing) {
            $invoiceId = $validated['invoice_id'] ?? null;

            if (! $invoiceId) {
                $invoiceId = $this->generateInvoiceForEnrollment($validated, $request) ?? null;
                $validated['invoice_id'] = $invoiceId;
            }

            if ($existing) {
                $existing->update([
                    'status' => 'enrolled',
                    'enrolled_at' => $validated['enrolled_at'],
                    'invoice_id' => $invoiceId ?? $existing->invoice_id,
                    'notes' => $validated['notes'] ?? $existing->notes,
                ]);

                $enrollment = $existing;
            } else {
                $enrollment = FormationEnrollment::create($validated);
            }

            $this->assignToAvailableSessions($enrollment);

            $enrollment->load(['course', 'learner', 'invoice', 'seller', 'sellerTrainer']);

            return $enrollment;
        });

        return response()->json($enrollment, 201);
    }

    public function show(FormationEnrollment $formationEnrollment): JsonResponse
    {
        $formationEnrollment->load(['course.modules', 'learner', 'invoice', 'seller', 'sellerTrainer']);

        return response()->json($formationEnrollment);
    }

    public function update(Request $request, FormationEnrollment $formationEnrollment): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'sometimes|string|in:enrolled,completed,cancelled',
            'notes' => 'nullable|string',
            'invoice_id' => 'nullable|exists:invoices,id',
            'seller_user_id' => 'nullable|exists:users,id',
            'seller_trainer_id' => 'nullable|exists:trainers,id|prohibits:seller_user_id',
        ]);

        $previousStatus = $formationEnrollment->status;

        $formationEnrollment->update($validated);

        if (array_key_exists('status', $validated) && $validated['status'] !== $previousStatus) {
            if ($validated['status'] === 'cancelled') {
                // On annule les participations pas encore terminées : le passé reste historisé.
                SessionParticipant::where('formation_enrollment_id', $formationEnrollment->id)
                    ->whereHas('session', fn ($q) => $q->where(fn ($w) => $w->where('end_at', '>', now())->orWhereNull('end_at')))
                    ->update(['status' => 'cancelled']);
            } else {
                SessionParticipant::where('formation_enrollment_id', $formationEnrollment->id)
                    ->whereHas('session', fn ($q) => $q->where(fn ($w) => $w->where('end_at', '>', now())->orWhereNull('end_at')))
                    ->update(['status' => 'enrolled']);
            }
        }

        $formationEnrollment->load(['course', 'learner', 'seller', 'sellerTrainer']);

        return response()->json($formationEnrollment);
    }

    /**
     * « Supprimer » = annuler (jamais de suppression physique) pour préserver l'historique.
     */
    public function destroy(FormationEnrollment $formationEnrollment): JsonResponse
    {
        DB::transaction(function () use ($formationEnrollment) {
            $formationEnrollment->update(['status' => 'cancelled']);
            SessionParticipant::where('formation_enrollment_id', $formationEnrollment->id)
                ->whereHas('session', fn ($q) => $q->where(fn ($w) => $w->where('end_at', '>', now())->orWhereNull('end_at')))
                ->update(['status' => 'cancelled']);
        });

        return response()->json(null, 204);
    }

    /**
     * Affecte l'inscription aux sessions à venir (jamais rétroactivement),
     * en respectant la capacité de chaque session.
     */
    private function assignToAvailableSessions(FormationEnrollment $enrollment): void
    {
        $sessions = TrainingSession::where('course_id', $enrollment->course_id)
            ->where('start_at', '>=', $enrollment->enrolled_at)
            ->get(['id', 'max_capacity']);

        foreach ($sessions as $session) {
            $count = SessionParticipant::where('training_session_id', $session->id)
                ->where('status', 'enrolled')
                ->count();

            if ($session->max_capacity !== null && $count >= $session->max_capacity) {
                continue;
            }

            SessionParticipant::updateOrCreate(
                [
                    'training_session_id' => $session->id,
                    'formation_enrollment_id' => $enrollment->id,
                ],
                ['status' => 'enrolled']
            );
        }
    }

    /**
     * Liste des apprenants d'une formation avec leur progression.
     */
    public function learners(Request $request, Course $course): JsonResponse
    {
        $enrollments = FormationEnrollment::where('course_id', $course->id)
            ->with(['learner', 'seller', 'sellerTrainer'])
            ->get()
            ->map(fn (FormationEnrollment $e) => [
                'id' => $e->id,
                'learner' => $e->learner,
                'status' => $e->status,
                'enrolled_at' => $e->enrolled_at,
                'seller' => $e->seller,
                'seller_trainer' => $e->sellerTrainer,
                'notes' => $e->notes,
            ]);

        return response()->json($enrollments);
    }

    /**
     * Génère automatiquement la facture d'inscription à partir du prix de la formation
     * (et du commercial/employé vendeur sélectionné, le cas échéant).
     */
    private function generateInvoiceForEnrollment(array $validated, Request $request): ?string
    {
        $course = Course::find($validated['course_id']);

        if (! $course) {
            return null;
        }

        $price = (float) $course->effective_price;

        if ($price <= 0) {
            return null;
        }

        $learner = User::find($validated['learner_user_id']);

        $sellerUserId = $validated['seller_user_id'] ?? null;

        if ($sellerUserId === null && empty($validated['seller_trainer_id'])) {
            $sellerUserId = $request->user()?->id;
        }

        $commercialId = null;

        if (! empty($sellerUserId)) {
            $commercial = Commercial::where('user_id', $sellerUserId)
                ->where('is_active', true)
                ->first();

            if ($commercial) {
                $commercialId = $commercial->id;
            }
        }

        $sellerTrainerName = null;

        if (! empty($validated['seller_trainer_id'])) {
            $sellerTrainer = Trainer::find($validated['seller_trainer_id']);
            $sellerTrainerName = $sellerTrainer
                ? trim(implode(' ', array_filter([$sellerTrainer->first_name, $sellerTrainer->last_name]))) ?: null
                : null;
        }

        $comment = "Inscription à la formation {$course->name}";

        if ($sellerTrainerName) {
            $comment .= " — Vendeur : {$sellerTrainerName}";
        }

        $invoice = Invoice::create([
            'number' => $this->invoiceNumber->next(),
            'agency_id' => $course->agency_id ?? $request->user()?->primaryAgency()->value('agencies.id'),
            'client_id' => $validated['learner_user_id'],
            'client_name' => $learner ? trim("{$learner->first_name} {$learner->last_name}") : null,
            'commercial_id' => $commercialId,
            'seller_user_id' => $sellerUserId,
            'invoice_date' => now(),
            'payment_type' => null,
            'total_amount' => $price,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'comment' => $comment,
        ]);

        $invoice->items()->create([
            'service_id' => null,
            'label' => "Formation {$course->name} ({$course->code})",
            'unit_price' => $price,
            'quantity' => 1,
            'line_total' => $price,
        ]);

        $this->logger->log(
            action: 'created',
            entityType: 'invoice',
            entityId: $invoice->id,
            description: "Facture {$invoice->number} générée automatiquement pour l'inscription à la formation {$course->name}",
            newValues: ['invoice' => $invoice->number, 'total_amount' => $price],
            request: $request,
        );

        return $invoice->id;
    }
}
