<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Prestation;
use App\Models\PrestationOffer;
use App\Services\PrestationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * Souscription d'un client connecté à une offre de prestation du catalogue
 * public. Miroir de l'inscription à une formation : sans connexion on renvoie
 * vers /connexion, sinon on crée la prestation « en attente de validation »
 * (sans preuve : le contrat et la facture naissent à la validation par
 * l'agence, puis le client paie par preuve depuis « Mes factures »).
 */
class ClientOfferSubscriptionController extends Controller
{
    public function __construct(
        private readonly PrestationService $prestations,
    ) {}

    #[OA\Post(
        path: '/api/client/offers/{offer}/subscribe',
        summary: 'Le client souscrit lui-même à une offre de prestation du catalogue public',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'offer', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 201, description: 'Prestation créée en attente de validation'),
            new OA\Response(response: 404, description: 'Offre indisponible'),
            new OA\Response(response: 409, description: 'Souscription déjà en cours'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function __invoke(Request $request, string $offer): JsonResponse
    {
        $offer = PrestationOffer::query()
            ->where('is_active', true)
            ->where('id', $offer)
            ->first();

        if (! $offer) {
            return response()->json(['message' => 'Offre indisponible.'], 404);
        }

        $data = $request->validate([
            'budget' => ['required', 'numeric', 'min:0'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);

        $client = $request->user();

        $already = Prestation::query()
            ->where('client_id', $client->id)
            ->where('offer_id', $offer->id)
            ->whereIn('status', [
                Prestation::STATUS_DRAFT,
                Prestation::STATUS_PENDING_VALIDATION,
                Prestation::STATUS_VALIDATED,
                Prestation::STATUS_IN_PROGRESS,
            ])
            ->exists();

        if ($already) {
            return response()->json([
                'message' => 'Vous avez déjà une souscription en cours pour cette prestation.',
            ], 409);
        }

        $prestation = $this->prestations->create([
            'agency_id' => $offer->agency_id,
            'department_id' => $offer->department_id,
            'category_id' => $offer->category_id,
            'offer_id' => $offer->id,
            'name' => $offer->name,
            'description' => $data['description'] ?? $offer->description,
            'client_id' => $client->id,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'budget' => $data['budget'],
        ], $client);

        $prestation = $this->prestations->submit($prestation);

        return response()->json([
            'prestation' => $prestation->fresh()->load(['agency:id,name', 'category:id,name']),
        ], 201);
    }
}
