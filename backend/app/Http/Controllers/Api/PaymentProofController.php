<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\InvoiceStatusMail;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Services\ActivityLogger;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use OpenApi\Attributes as OA;

/**
 * Examen des preuves de paiement par le personnel (caissier / direction).
 * Permet au caissier de vérifier une preuve soumise par un client (ou un
 * commercial pour un paiement numérique) avant de valider et encaisser.
 */
class PaymentProofController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $logger,
        private readonly PaymentService $paymentService,
    ) {}

    #[OA\Get(
        path: '/api/payment-proofs',
        summary: 'Lister les preuves de paiement avec filtres',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['pending', 'accepted', 'rejected'])),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des preuves'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = PaymentProof::query()
            ->with(['invoice:id,number,client_name,total_amount,validation_status,status', 'submitter:id,first_name,last_name,email', 'reviewer:id,first_name,last_name,email'])
            ->when($request->filled('invoice_id'), fn ($q) => $q->where('invoice_id', $request->input('invoice_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->input('status')))
            ->orderByDesc('created_at');

        return response()->json($query->paginate(min((int) $request->input('per_page', 15), 100)));
    }

    #[OA\Post(
        path: '/api/payment-proofs/{proof}/approve',
        summary: 'Accepter une preuve de paiement',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'proof', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Preuve acceptée'),
            new OA\Response(response: 422, description: 'Preuve déjà traitée'),
        ]
    )]
    public function approve(Request $request, PaymentProof $proof): JsonResponse
    {
        return $this->review($request, $proof, PaymentProof::STATUS_ACCEPTED);
    }

    #[OA\Post(
        path: '/api/payment-proofs/{proof}/reject',
        summary: 'Rejeter une preuve de paiement (motif obligatoire)',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'proof', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['notes'],
                properties: [
                    new OA\Property(property: 'notes', type: 'string', description: 'Motif du rejet de la preuve'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Preuve rejetée'),
            new OA\Response(response: 422, description: 'Preuve déjà traitée ou motif manquant'),
        ]
    )]
    public function reject(Request $request, PaymentProof $proof): JsonResponse
    {
        $request->validate(['notes' => ['required', 'string']]);

        return $this->review($request, $proof, PaymentProof::STATUS_REJECTED);
    }

    private function review(Request $request, PaymentProof $proof, string $status): JsonResponse
    {
        abort_if($proof->status !== PaymentProof::STATUS_PENDING, 422, 'Cette preuve a déjà été traitée.');

        DB::transaction(function () use ($request, $proof, $status) {
            $proof->update([
                'status' => $status,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'notes' => $status === PaymentProof::STATUS_REJECTED ? trim((string) $request->input('notes', '')) : null,
            ]);

            // Chaînage du workflow : accepter la preuve valide automatiquement la
            // facture, la rejeter la rejette automatiquement. Cela évite les états
            // incohérents (preuve acceptée mais facture rejetée, ou l'inverse).
            $invoice = Invoice::find($proof->invoice_id);

            if ($invoice && $invoice->validation_status === Invoice::VALIDATION_PENDING) {
                if ($status === PaymentProof::STATUS_ACCEPTED) {
                    $this->markInvoiceValidated($invoice, $request->user()->id);
                } else {
                    $reason = 'Preuve de paiement rejetée : '.trim((string) $request->input('notes', ''));
                    $this->markInvoiceRejected($invoice, $request->user()->id, $reason);
                }
            }

            $this->logger->log(
                action: $status === PaymentProof::STATUS_ACCEPTED ? 'proof_accepted' : 'proof_rejected',
                entityType: 'invoice',
                entityId: $proof->invoice_id,
                description: sprintf(
                    'Preuve de paiement (%s) %s pour la facture %s',
                    $proof->payment_method,
                    $status === PaymentProof::STATUS_ACCEPTED ? 'acceptée' : 'rejetée',
                    $invoice?->number ?? $proof->invoice_id,
                ),
                newValues: ['proof' => $proof->id, 'status' => $status],
                request: $request,
            );
        });

        $invoice = Invoice::with([
            'items',
            'payments',
            'commissionPayments',
            'client',
            'commercial',
            'agency',
            'seller',
            'paymentProofs' => fn ($q) => $q->with(['submitter:id,first_name,last_name,email', 'reviewer:id,first_name,last_name,email']),
        ])->find($proof->invoice_id);

        return response()->json([
            'proof' => $proof->fresh(),
            'invoice' => $invoice,
        ]);
    }

    private function markInvoiceValidated(Invoice $invoice, string $userId): void
    {
        $invoice->update([
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'validated_by' => $userId,
            'validated_at' => now(),
            'rejection_reason' => null,
        ]);

        // L'avance annoncée par le commercial à la création n'a pas été encaissée
        // (il ne peut pas manier de caisse) : elle est appliquée maintenant, au
        // moment où un caissier / la direction valide la facture via la preuve.
        if ((float) ($invoice->declared_advance ?? 0) > 0 && (float) $invoice->amount_paid === 0.0) {
            $this->paymentService->applyPayment(
                $invoice,
                (float) $invoice->declared_advance,
                $invoice->payment_type ?? 'cash',
                true,
                $userId,
            );
        }

        $this->logger->log('validated', 'invoice', $invoice->id, "Facture {$invoice->number} validée (preuve de paiement acceptée)");

        $this->sendStatusNotification($invoice);
    }

    private function markInvoiceRejected(Invoice $invoice, string $userId, string $reason): void
    {
        $invoice->update([
            'validation_status' => Invoice::VALIDATION_REJECTED,
            'validated_by' => $userId,
            'validated_at' => now(),
            'rejection_reason' => $reason,
        ]);

        $this->logger->log('rejected', 'invoice', $invoice->id, "Facture {$invoice->number} rejetée : {$reason}");

        $this->sendStatusNotification($invoice);
    }

    private function sendStatusNotification(Invoice $invoice): void
    {
        $email = $invoice->client?->email;

        if (! $email) {
            return;
        }

        $frontend = rtrim((string) env('FRONTEND_URL', ''), '/');

        Mail::to($email)->send(new InvoiceStatusMail(
            invoice: $invoice,
            clientUrl: $frontend !== '' ? "{$frontend}/mon-compte/factures" : null,
        ));
    }
}
