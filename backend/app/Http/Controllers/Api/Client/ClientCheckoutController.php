<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\ActivityLogger;
use App\Services\OrderInvoicingService;
use App\Services\OrderNumberGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class ClientCheckoutController extends Controller
{
    public function __construct(
        private readonly OrderNumberGenerator $orderNumber,
        private readonly OrderInvoicingService $invoicing,
        private readonly ActivityLogger $logger,
    ) {}

    /**
     * Flux en un clic : crée la commande (client_self, confirmée) puis sa facture
     * en attente de validation (pending/online) en une seule transaction.
     */
    #[OA\Post(
        path: '/api/client/checkout',
        summary: 'Commander puis générer la facture pour le client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Commande + facture créées'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $data = $this->validateCheckout($request);

        list($order, $invoice) = DB::transaction(function () use ($data, $request) {
            $agencyId = $data['agency_id'] ?? null;
            if (! $agencyId) {
                throw ValidationException::withMessages(['agency_id' => 'Veuillez sélectionner une agence.']);
            }

            $lines = $this->invoicing->buildLines($data['lines']);
            $subtotal = round(collect($lines)->sum('line_total'), 2);
            $total = round(max(0, $subtotal - (float) ($data['discount'] ?? 0)), 2);

            $order = Order::create([
                'number' => $this->orderNumber->next(),
                'agency_id' => $agencyId,
                'client_id' => $request->user()->id,
                'commercial_id' => null,
                'status' => 'confirmed',
                'channel' => 'client_self',
                'order_date' => now()->toDateString(),
                'subtotal' => $subtotal,
                'discount' => (float) ($data['discount'] ?? 0),
                'vat_rate' => (float) ($data['vat_rate'] ?? 0),
                'total_amount' => $total,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($lines as $line) {
                $order->lines()->create($line);
            }

            $invoice = $this->invoicing->invoiceFromOrder($order, $request->user()->id);

            $this->logger->log(
                action: 'checkout',
                entityType: 'order',
                entityId: $order->id,
                description: "Commande {$order->number} (checkout client) facturée {$invoice->number}",
                newValues: ['order' => $order->number, 'invoice' => $invoice->number, 'total' => $total],
                request: $request,
            );

            return [$order, $invoice];
        });

        return response()->json([
            'order' => $order->fresh()->load(['agency:id,name,city', 'lines']),
            'invoice' => $invoice->fresh()->load(['items', 'client']),
        ], 201);
    }

    private function validateCheckout(Request $request): array
    {
        return $request->validate([
            'agency_id' => ['required', 'uuid', 'exists:agencies,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.line_type' => ['nullable', 'in:catalog,manual'],
            'lines.*.service_id' => ['required_if:lines.*.line_type,catalog', 'nullable', 'uuid', 'exists:services,id'],
            'lines.*.label' => ['required_if:lines.*.line_type,manual', 'nullable', 'string', 'max:255'],
            'lines.*.description' => ['nullable', 'string'],
            'lines.*.unit_price' => ['required_if:lines.*.line_type,manual', 'nullable', 'numeric', 'min:0'],
            'lines.*.quantity' => ['nullable', 'integer', 'min:1', 'max:9999'],
        ]);
    }
}
