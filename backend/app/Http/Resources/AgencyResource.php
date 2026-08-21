<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AgencyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'country' => $this->country,
            'city' => $this->city,
            'country_id' => $this->country_id,
            'city_id' => $this->city_id,
            'address' => $this->address,
            'full_address' => $this->full_address,
            'phone' => $this->phone,
            'email' => $this->email,
            'type' => $this->type,
            'activities' => $this->whenLoaded('activities', fn () => $this->activities
                ->map(fn ($activity) => [
                    'id' => $activity->id,
                    'type' => $activity->type,
                    'is_active' => $activity->is_active,
                ])
                ->values()
                ->all()),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'deleted_at' => $this->deleted_at?->toISOString(),
            'departments' => DepartmentResource::collection($this->whenLoaded('departments')),
            'assigned_users' => UserResource::collection($this->whenLoaded('assignedUsers')),
        ];
    }
}
