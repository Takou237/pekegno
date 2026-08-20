<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'name' => $this->first_name . ' ' . $this->last_name,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'client_number' => $this->client_number,
            'client_category' => $this->whenLoaded('clientCategory', fn () => [
                'id' => $this->clientCategory->id,
                'name' => $this->clientCategory->name,
                'slug' => $this->clientCategory->slug,
            ]),
            'status' => $this->status,
            'city' => $this->city,
            'country' => $this->country,
            'city_id' => $this->city_id,
            'country_id' => $this->country_id,
            'region' => $this->whenLoaded('geoCity', fn () => $this->geoCity?->name),
            'country_name' => $this->whenLoaded('geoCountry', fn () => $this->geoCountry?->name),
            'registered_at' => $this->registered_at?->toISOString(),
            'registered_agency' => $this->whenLoaded('registeredAgency', fn () => [
                'id' => $this->registeredAgency->id,
                'name' => $this->registeredAgency->name,
                'code' => $this->registeredAgency->code,
            ]),
            'referring_commercial' => $this->whenLoaded('referringCommercial', fn () => [
                'id' => $this->referringCommercial->id,
                'first_name' => $this->referringCommercial->first_name,
                'last_name' => $this->referringCommercial->last_name,
            ]),
            'address' => $this->address,
            'is_active' => $this->is_active,
            'role' => $this->whenLoaded('role'),
            'role_id' => $this->role_id,
            'email_verified_at' => $this->email_verified_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'pivot' => $this->when(isset($this->pivot), fn () => [
                'department_id' => $this->pivot->department_id,
                'is_primary' => $this->pivot->is_primary,
                'is_department_chief' => $this->pivot->is_department_chief,
            ]),
            'assignments' => $this->whenLoaded('assignments', fn () =>
                $this->assignments->map(fn ($a) => [
                    'id' => $a->id,
                    'name' => $a->name,
                    'pivot' => [
                        'department_id' => $a->pivot->department_id,
                        'is_primary' => $a->pivot->is_primary,
                        'is_department_chief' => $a->pivot->is_department_chief,
                    ],
                ])
            ),
        ];
    }
}
