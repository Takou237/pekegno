<?php

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Info(
    title: 'PEKEGNO API',
    version: '1.0.0',
    description: 'API de gestion multi-agence PEKEGNO'
)]
#[OA\Server(
    url: 'http://127.0.0.1:8000/api',
    description: 'Serveur local'
)]
#[OA\SecurityScheme(
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'sanctum',
    securityScheme: 'sanctum'
)]
#[OA\PathItem(path: '/api')]
class OpenApi
{
}
