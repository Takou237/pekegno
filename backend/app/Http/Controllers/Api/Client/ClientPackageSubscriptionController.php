<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\SubscriptionPack;
use App\Services\PackageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * Souscription d'un client connecté à un package du catalogue public.
 * Même moteur que la souscription en agence (contrat + prestation + facture), mais la
 * facture naît « pending » : elle est validée par l'agence et payée par preuve depuis
 * l'espace « Mes factures ».
 */
class ClientPackageSubscriptionController extends Controller
{
    public function __construct(
        private readonly PackageService $packages,
    ) {}

    #[OA\Post(
        path: '/api/client/packages/{package}/subscribe',
        summary: 'Le client souscrit lui-même à un package du catalogue public',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'package', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 201, description: 'Contrat + prestation + facture créés'),
            new OA\Response(response: 404, description: 'Package indisponible'),
            new OA\Response(response: 409, description: 'Souscription déjà en cours'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function __invoke(Request $request, string $package): JsonResponse
    {
        $pack = SubscriptionPack::query()
            ->where('is_public', true)
            ->where('is_active', true)
            ->where('id', $package)
            ->first();

        if (! $pack) {
            return response()->json(['message' => 'Package introuvable.'], 404);
        }

        if ($pack->agency_id === null) {
            throw ValidationException::withMessages([
                'package' => "Ce package ne dépend pas d'une agence : contactez PEKEGNO pour y souscrire.",
            ]);
        }

        $data = $request->validate([
            'start_date' => ['nullable', 'date'],
            'periods' => ['required', 'integer', 'min:1', 'max:60'],
            // Mêmes libellés que la souscription en agence (caissier / commercial) :
            // `payment_type` (cash, om, momo, mobile) ou `payment_method`.
            'payment_type' => ['nullable', 'string', 'max:30'],
            'payment_method' => ['nullable', 'string', 'max:30'],
            'advance' => ['nullable', 'numeric', 'min:0.01'],
            'auto_renew' => ['nullable', 'boolean'],
        ]);

        $client = $request->user();

        $already = Contract::query()
            ->where('client_id', $client->id)
            ->where('pack_id', $pack->id)
            ->whereIn('status', [Contract::STATUS_PENDING, Contract::STATUS_ACTIVE, Contract::STATUS_DUE_SOON])
            // Une souscription dont la facture a été annulée, rejetée (paiement
            // refusé) ou supprimée par le client n'est plus « en cours » : le
            // client peut souscrire de nouveau.
            ->whereHas('invoices', fn ($invoices) => $invoices
                ->whereNull('cancelled_at')
                ->where('validation_status', '!=', Invoice::VALIDATION_REJECTED))
            ->exists();

        if ($already) {
            return response()->json([
                'message' => 'Vous avez déjà une souscription en cours pour ce package.',
            ], 409);
        }

        $result = $this->packages->subscribe(
            package: $pack,
            client: $client,
            start: Carbon::parse($data['start_date'] ?? today()->toDateString()),
            periods: (int) $data['periods'],
            commercialId: null,
            actorUserId: $client->id,
            departmentId: null,
            autoRenew: (bool) ($data['auto_renew'] ?? false),
            advance: isset($data['advance']) ? (float) $data['advance'] : null,
            paymentType: $data['payment_type'] ?? $data['payment_method'] ?? null,
            needsValidation: true,
            paymentProof: null,
        );

        return response()->json([
            'contract' => $result['contract']->load('pack:id,name,billing_period'),
            'prestation' => $result['prestation']->load('actions'),
            'invoice' => $result['invoice']->load('items'),
        ], 201);
    }
}
