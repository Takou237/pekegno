<?php

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Schema(schema: 'User', properties: [
    new OA\Property(property: 'id', type: 'string', format: 'uuid'),
    new OA\Property(property: 'username', type: 'string'),
    new OA\Property(property: 'email', type: 'string', format: 'email'),
    new OA\Property(property: 'first_name', type: 'string', nullable: true),
    new OA\Property(property: 'last_name', type: 'string', nullable: true),
    new OA\Property(property: 'phone', type: 'string', nullable: true),
    new OA\Property(property: 'is_active', type: 'boolean'),
    new OA\Property(property: 'role_id', type: 'string', format: 'uuid'),
    new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
])]
#[OA\Schema(schema: 'Role', properties: [
    new OA\Property(property: 'id', type: 'string', format: 'uuid'),
    new OA\Property(property: 'name', type: 'string'),
    new OA\Property(property: 'description', type: 'string', nullable: true),
    new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
])]
#[OA\Schema(schema: 'Permission', properties: [
    new OA\Property(property: 'id', type: 'string', format: 'uuid'),
    new OA\Property(property: 'name', type: 'string'),
    new OA\Property(property: 'description', type: 'string', nullable: true),
    new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
])]
#[OA\Schema(schema: 'Agency', properties: [
    new OA\Property(property: 'id', type: 'string', format: 'uuid'),
    new OA\Property(property: 'code', type: 'string'),
    new OA\Property(property: 'name', type: 'string'),
    new OA\Property(property: 'country', type: 'string'),
    new OA\Property(property: 'city', type: 'string', nullable: true),
    new OA\Property(property: 'address', type: 'string', nullable: true),
    new OA\Property(property: 'phone', type: 'string', nullable: true),
    new OA\Property(property: 'email', type: 'string', nullable: true),
    new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
])]
#[OA\Schema(schema: 'Department', properties: [
    new OA\Property(property: 'id', type: 'string', format: 'uuid'),
    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid'),
    new OA\Property(property: 'name', type: 'string'),
    new OA\Property(property: 'description', type: 'string', nullable: true),
    new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
])]
class Schemas
{
}
