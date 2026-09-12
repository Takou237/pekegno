<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Services\ActivityLogger;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\Response;

class ClientInvoiceController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    #[OA\Get(
        path: '/api/client/invoices',
        summary: 'Lister les factures du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des factures'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['agency:id,name,city', 'items'])
            ->where('client_id', $request->user()->id);

        if ($request->filled('validation_status')) {
            $query->whereIn('validation_status', array_filter(array_map('trim', explode(',', (string) $request->input('validation_status')))));
        }

        $invoices = $query->orderByDesc('invoice_date')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($invoices);
    }

    #[OA\Get(
        path: '/api/client/invoices/{invoice}',
        summary: 'Détail d\'une facture du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de la facture'),
            new OA\Response(response: 404, description: 'Facture introuvable'),
        ]
    )]
    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless($invoice->client_id === $request->user()->id, 404, 'Facture introuvable.');

        return response()->json(
            $invoice->load(['agency:id,name,city,address,phone,email', 'items', 'payments', 'paymentProofs'])
        );
    }

    /**
     * Upload une preuve de paiement pour une facture du client connecté.
     * La preuve reste en attente (pending) jusqu'à validation par le personnel.
     */
    #[OA\Post(
        path: '/api/client/invoices/{invoice}/payment-proof',
        summary: 'Soumettre une preuve de paiement pour une facture',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(
                mediaType: 'multipart/form-data',
                schema: new OA\Schema(
                    required: ['file', 'payment_method'],
                    properties: [
                        new OA\Property(property: 'file', type: 'string', format: 'binary'),
                        new OA\Property(property: 'payment_method', type: 'string'),
                        new OA\Property(property: 'phone_number_used', type: 'string'),
                        new OA\Property(property: 'reference', type: 'string'),
                    ]
                )
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Preuve soumise'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function uploadProof(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless($invoice->client_id === $request->user()->id, 404, 'Facture introuvable.');

        $data = $request->validate([
            'file' => ['required', 'file', 'image', 'mimes:jpeg,png,gif,webp', 'max:5120'],
            'payment_method' => ['required', 'string', 'max:30'],
            'phone_number_used' => ['nullable', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:100'],
        ]);

        $path = $request->file('file')->store('payment-proofs', 'public');

        $proof = PaymentProof::create([
            'invoice_id' => $invoice->id,
            'submitted_by' => $request->user()->id,
            'payment_method' => $data['payment_method'],
            'phone_number_used' => $data['phone_number_used'] ?? null,
            'reference' => $data['reference'] ?? null,
            'file_path' => $path,
            'status' => 'pending',
        ]);

        $this->logger->log(
            action: 'proof_submitted',
            entityType: 'invoice',
            entityId: $invoice->id,
            description: "Preuve de paiement ({$data['payment_method']}) soumise pour la facture {$invoice->number}",
            newValues: ['payment_proof' => $proof->id, 'method' => $data['payment_method']],
            request: $request,
        );

        return response()->json([
            'payment_proof' => $proof,
            'url' => Storage::disk('public')->url($path),
        ], 201);
    }

    /**
     * Supprime une facture rejetée du client connecté.
     * Seule une facture dont le statut de validation est "rejected" peut être supprimée.
     */
    #[OA\Delete(
        path: '/api/client/invoices/{invoice}',
        summary: 'Supprimer une facture rejetée du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Facture supprimée'),
            new OA\Response(response: 404, description: 'Facture introuvable'),
            new OA\Response(response: 422, description: 'Seule une facture rejetée est supprimable'),
        ]
    )]
    public function destroy(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless($invoice->client_id === $request->user()->id, 404, 'Facture introuvable.');
        abort_if($invoice->validation_status !== Invoice::VALIDATION_REJECTED, 422, 'Seule une facture rejetée peut être supprimée.');

        $number = $invoice->number;

        $invoice->paymentProofs()->delete();
        $invoice->payments()->delete();
        $invoice->items()->delete();
        $invoice->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'invoice',
            entityId: $invoice->id,
            description: "Le client a supprimé la facture rejetée {$number}",
            request: $request,
        );

        return response()->json(['message' => "Facture {$number} supprimée."]);
    }

    /**
     * Télécharge le reçu PDF de la facture du client connecté.
     */
    #[OA\Get(
        path: '/api/client/invoices/{invoice}/receipt',
        summary: 'Télécharger le reçu PDF d\'une facture',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'PDF du reçu'),
            new OA\Response(response: 404, description: 'Facture introuvable'),
        ]
    )]
    public function receipt(Request $request, Invoice $invoice): Response
    {
        abort_unless($invoice->client_id === $request->user()->id, 404, 'Facture introuvable.');

        $invoice->load(['agency:id,name,city,address,phone,email', 'items']);

        $pdf = Pdf::loadView('pdf.invoice-receipt', ['invoice' => $invoice]);

        $this->logger->log(
            action: 'receipt_downloaded',
            entityType: 'invoice',
            entityId: $invoice->id,
            description: "Reçu PDF de la facture {$invoice->number} téléchargé",
            request: $request,
        );

        return $pdf->download("facture-{$invoice->number}.pdf");
    }
}
