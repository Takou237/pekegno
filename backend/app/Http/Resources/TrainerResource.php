<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrainerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'bio' => $this->bio,
            'points_balance' => (int) $this->points_balance,
            'is_active' => $this->is_active,
            /** Compte utilisateur lié : null si le formateur n'utilise pas la plateforme. */
            'user_id' => $this->user_id,
            'has_account' => $this->user_id !== null,
            'agency' => $this->whenLoaded('agency', fn () => [
                'id' => $this->agency?->id,
                'name' => $this->agency?->name,
                'code' => $this->agency?->code,
            ]),
            'sessions_count' => $this->whenCounted('sessions'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
