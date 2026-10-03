<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\AgencyNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Notifications in-app Agency de l'utilisateur connecté (staff ou client). */
class AgencyNotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AgencyNotification::where('user_id', $request->user()->id)
            ->when($request->boolean('unread'), fn ($q) => $q->unread())
            ->latest();

        return response()->json(array_merge(
            $query->paginate(min((int) $request->input('per_page', 20), 100))->toArray(),
            ['unread_count' => AgencyNotification::where('user_id', $request->user()->id)->unread()->count()],
        ));
    }

    public function markRead(Request $request, AgencyNotification $notification): JsonResponse
    {
        abort_unless($notification->user_id === $request->user()->id, 404);

        $notification->update(['read_at' => $notification->read_at ?? now()]);

        return response()->json($notification);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AgencyNotification::where('user_id', $request->user()->id)->unread()->update(['read_at' => now()]);

        return response()->json(['message' => 'Notifications marquées comme lues.']);
    }
}
