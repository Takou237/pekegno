<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FormationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'duration' => $this->duration,
            'conditions' => $this->conditions,
            'deposit_amount' => $this->deposit_amount === null ? null : (string) $this->deposit_amount,
            'installments_count' => $this->installments_count,
            'online_payment' => (bool) $this->online_payment,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'service' => new ServiceResource($this->whenLoaded('service')),
            'modules' => ModuleResource::collection($this->whenLoaded('modules')),
            'modules_count' => $this->whenCounted('modules'),
        ];
    }
}
