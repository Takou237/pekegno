<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

class SettingController extends Controller
{
    private const ALLOWED_KEYS = [
        'sales_points_per_sale',
        'prospect_points_per_add',
        'prospect_points_per_conversion',
        'inactivity_period_days',
        'inactivity_penalty_points',
        'default_commission_type',
        'default_commission_value',
        'invoice_prefix',
    ];

    public function __construct(private readonly ActivityLogger $logger) {}

    #[OA\Get(
        path: '/api/settings',
        summary: 'Lister les réglages applicatifs',
        tags: ['Réglages'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des réglages'),
        ]
    )]
    public function index(): JsonResponse
    {
        $settings = Setting::orderBy('key')->get()->map(fn (Setting $s) => [
            'key' => $s->key,
            'value' => $s->value,
            'description' => $s->description,
            'updated_by' => $s->updated_by,
            'updated_at' => $s->updated_at?->toISOString(),
        ]);

        return response()->json($settings);
    }

    #[OA\Put(
        path: '/api/settings',
        summary: 'Mettre à jour un ou plusieurs réglages',
        tags: ['Réglages'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'sales_points_per_sale', type: 'integer', example: 3),
                    new OA\Property(property: 'prospect_points_per_add', type: 'integer', example: 2),
                    new OA\Property(property: 'prospect_points_per_conversion', type: 'integer', example: 5),
                    new OA\Property(property: 'inactivity_period_days', type: 'integer', example: 14),
                    new OA\Property(property: 'inactivity_penalty_points', type: 'integer', example: 5),
                    new OA\Property(property: 'default_commission_type', type: 'string', enum: ['none', 'percent', 'fixed']),
                    new OA\Property(property: 'default_commission_value', type: 'number', example: 0),
                    new OA\Property(property: 'invoice_prefix', type: 'string', example: 'PK'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Réglages mis à jour'),
            new OA\Response(response: 422, description: 'Clé ou valeur invalide'),
        ]
    )]
    public function update(Request $request): JsonResponse
    {
        $unknown = array_diff(array_keys($request->all()), self::ALLOWED_KEYS);
        if ($unknown) {
            return response()->json([
                'message' => 'Réglage(s) inconnu(s) : '.implode(', ', $unknown),
            ], 422);
        }

        $data = $request->validate([
            'sales_points_per_sale' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            'prospect_points_per_add' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            'prospect_points_per_conversion' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            'inactivity_period_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'inactivity_penalty_points' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            'default_commission_type' => ['sometimes', Rule::in(['none', 'percent', 'fixed'])],
            'default_commission_value' => ['sometimes', 'numeric', 'min:0'],
            'invoice_prefix' => ['sometimes', 'string', 'min:1', 'max:5'],
        ]);

        $userId = $request->user()->id;

        foreach ($data as $key => $value) {
            Setting::set($key, $value, updatedBy: $userId);
        }

        $this->logger->log('updated', 'settings', null, 'Réglages mis à jour', newValues: $data);

        return response()->json(Setting::orderBy('key')->get());
    }
}
