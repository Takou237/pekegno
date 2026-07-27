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
        ];
    }
}
