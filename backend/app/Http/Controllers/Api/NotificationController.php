<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class NotificationController extends Controller
{
    #[OA\Get(
        path: '/api/notifications',
        summary: 'Lister les notifications de l\'utilisateur connecté (filtre non lues/lues)',
        tags: ['Notifications'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des notifications'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = AppNotification::where('user_id', $request->user()->id)
            ->latest();

        if ($request->boolean('unread_only')) {
            $query->whereNull('read_at');
        }

        $notifications = $query->take(min((int) $request->input('limit', 50), 100))->get();

        return response()->json($notifications);
    }

    #[OA\Get(
        path: '/api/notifications/unread-count',
        summary: 'Nombre de notifications non lues de l\'utilisateur connecté',
        tags: ['Notifications'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Compteur de notifications non lues'),
        ]
    )]
    public function unreadCount(Request $request): JsonResponse
    {
        $count = AppNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    #[OA\Post(
        path: '/api/notifications/{notification}/read',
        summary: 'Marquer une notification comme lue',
        tags: ['Notifications'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Notification marquée lue'),
        ]
    )]
    public function markRead(Request $request, AppNotification $notification): JsonResponse
    {
        // Un utilisateur ne peut marquer que ses propres notifications.
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Non autorisé.'], 403);
        }

        $notification->markAsRead();

        return response()->json($notification->fresh());
    }

    #[OA\Post(
        path: '/api/notifications/read-all',
        summary: 'Marquer toutes les notifications comme lues',
        tags: ['Notifications'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Notifications marquées lues'),
        ]
    )]
    public function readAll(Request $request): JsonResponse
    {
        AppNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }
}
