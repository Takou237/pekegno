<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class SubscriptionNotificationController extends Controller
{
    #[OA\Get(
        path: '/api/subscription-notifications',
        summary: 'Historique des rappels d\'expiration (filtres)',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'subscription_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'type', in: 'query', description: 'Type de rappel (14_days, 7_days, 2_days, 1_day, expired)', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['pending', 'sent', 'failed'])),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des notifications'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $notifications = SubscriptionNotification::query()
            ->with('subscription.pack:id,name', 'subscription.client:id,first_name,last_name,email')
            ->when($request->subscription_id, fn ($q, $id) => $q->where('subscription_id', $id))
            ->when($request->type, fn ($q, $type) => $q->where('notification_type', $type))
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($notifications);
    }

    #[OA\Post(
        path: '/api/subscription-notifications/{notification}/retry',
        summary: 'Relancer l\'envoi d\'un rappel (compteur d\'essais)',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'notification', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Rappel relancé'),
        ]
    )]
    public function retry(Request $request, SubscriptionNotification $notification): JsonResponse
    {
        $notification->update([
            'status' => 'sent',
            'sent_at' => now(),
            'attempt_count' => $notification->attempt_count + 1,
            'error_message' => null,
        ]);

        return response()->json($notification->fresh()->load('subscription.pack:id,name'));
    }
}