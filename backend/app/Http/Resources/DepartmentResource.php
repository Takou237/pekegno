<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DepartmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'agency_id' => $this->agency_id,
            'agency' => new AgencyResource($this->whenLoaded('agency')),
            'assigned_users' => UserResource::collection($this->whenLoaded('assignedUsers')),
            'agency_chief' => $this->whenLoaded('agency', fn () => $this->agency->assignedUsers->first() ? [
                'id' => $this->agency->assignedUsers->first()->id,
                'name' => $this->agency->assignedUsers->first()->first_name . ' ' . $this->agency->assignedUsers->first()->last_name,
                'email' => $this->agency->assignedUsers->first()->email,
            ] : null),
            'department_chief' => $this->whenLoaded('assignedUsers', fn () => $this->assignedUsers->first() ? [
                'id' => $this->assignedUsers->first()->id,
                'name' => $this->assignedUsers->first()->first_name . ' ' . $this->assignedUsers->first()->last_name,
                'email' => $this->assignedUsers->first()->email,
            ] : null),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
