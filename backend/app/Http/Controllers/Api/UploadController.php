<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UploadFileRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;

class UploadController extends Controller
{
    #[OA\Post(
        path: '/api/uploads',
        summary: 'Uploader une image (couverture de service)',
        tags: ['Uploads'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(
                mediaType: 'multipart/form-data',
                schema: new OA\Schema(
                    required: ['file'],
                    properties: [
                        new OA\Property(property: 'file', type: 'string', format: 'binary'),
                    ]
                )
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Fichier uploadé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(UploadFileRequest $request): JsonResponse
    {
        $path = $request->file('file')->store('uploads', 'public');

        return response()->json([
            'url' => Storage::disk('public')->url($path),
            'path' => $path,
        ], 201);
    }
}
