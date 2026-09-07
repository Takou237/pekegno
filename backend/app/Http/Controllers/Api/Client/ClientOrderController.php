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

class ClientOrderController extends Controller
{
    public function __construct(
        private readonly OrderNumberGenerator $orderNumber,
        private readonly OrderInvoicingService $invoicing,
        private readonly ActivityLogger $logger,
    ) {}

    #[OA\Get(
        path: '/api/client/orders',
        summary: 'Lister les commandes du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des commandes'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['agency:id,name,city', 'lines', 'invoice:id,number,validation_status,total_amount,amount_paid,status'])
            ->where('client_id', $request->user()->id);

        if ($request->filled('status')) {
            $query->whereIn('status', array_filter(array_map('trim', explode(',', (string) $request->input('status')))));
        }

        $orders = $query->orderByDesc('order_date')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($orders);
    }

    #[OA\Post(
        path: '/api/client/orders',
        summary: 'Créer une commande pour le client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Commande créée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateOrder($request);

        $order = DB::transaction(function () use ($data, $request) {
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

            $this->logger->log(
                action: 'created',
                entityType: 'order',
                entityId: $order->id,
                description: "Commande client {$order->number} créée ({$total} FCFA)",
                newValues: ['number' => $order->number, 'total' => $total, 'channel' => 'client_self'],
                request: $request,
            );

            return $order;
        });

        return response()->json(
            $order->fresh()->load(['agency:id,name,city', 'lines']),
            201
        );
    }

    #[OA\Get(
        path: '/api/client/orders/{order}',
        summary: 'Détail d\'une commande du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'order', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de la commande'),
            new OA\Response(response: 404, description: 'Commande introuvable'),
        ]
    )]
    public function show(Request $request, Order $order): JsonResponse
    {
        abort_unless($order->client_id === $request->user()->id, 404, 'Commande introuvable.');

        return response()->json(
            $order->load(['agency:id,name,city,address,phone,email', 'lines', 'invoice:id,number,validation_status,status,total_amount,amount_paid,invoice_date,validated_at,rejection_reason', 'invoice.items'])
        );
    }

    private function validateOrder(Request $request): array
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
