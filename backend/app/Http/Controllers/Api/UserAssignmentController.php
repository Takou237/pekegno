<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class UserAssignmentController extends Controller
{
    #[OA\Put(
        path: '/api/agencies/{agency}/chief',
        summary: 'Assigner un chef d\'agence (is_primary dans user_assignments)',
        tags: ['Agences - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['user_id'],
                properties: [
                    new OA\Property(property: 'user_id', type: 'string', format: 'uuid'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Chef d\'agence assigné'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function assignChief(Request $request, Agency $agency): JsonResponse
    {
        $request->validate([
            'user_id' => ['required', 'string', 'exists:users,id'],
        ], [
            'user_id.required' => "L'utilisateur est obligatoire.",
            'user_id.exists' => "Cet utilisateur n'existe pas.",
        ]);

        $userId = $request->input('user_id');

        DB::transaction(function () use ($agency, $userId) {
            // Retirer le statut chef de l'ancien chef
            DB::table('user_assignments')
                ->where('agency_id', $agency->id)
                ->where('is_primary', true)
                ->update(['is_primary' => false]);

            // Créer ou mettre à jour l'assignation du nouveau chef
            $existing = DB::table('user_assignments')
                ->where('user_id', $userId)
                ->where('agency_id', $agency->id)
                ->first();

            if ($existing) {
                DB::table('user_assignments')
                    ->where('user_id', $userId)
                    ->where('agency_id', $agency->id)
                    ->update(['is_primary' => true]);
            } else {
                DB::table('user_assignments')->insert([
                    'user_id' => $userId,
                    'agency_id' => $agency->id,
                    'department_id' => null,
                    'is_primary' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        $agency->load('assignedUsers');

        return response()->json([
            'message' => 'Chef d\'agence assigné avec succès.',
            'agency' => $agency,
        ]);
    }

    #[OA\Delete(
        path: '/api/agencies/{agency}/chief',
        summary: 'Retirer le chef d\'agence',
        tags: ['Agences - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Chef retiré'),
        ]
    )]
    public function removeChief(Agency $agency): JsonResponse
    {
        DB::table('user_assignments')
            ->where('agency_id', $agency->id)
            ->where('is_primary', true)
            ->update(['is_primary' => false]);

        return response()->json(['message' => 'Chef d\'agence retiré avec succès.']);
    }
}
