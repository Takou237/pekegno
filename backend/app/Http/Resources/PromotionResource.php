<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PromotionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $basePrice = null;

        if ($this->service !== null) {
            $basePrice = (float) $this->service->price;
        } elseif ($this->formation !== null) {
            $basePrice = (float) $this->formation->price;
        }

        return [
            'id' => $this->id,
            'service_id' => $this->service_id,
            'formation_id' => $this->formation_id,
            'type' => $this->type,
            'promo_price' => $this->promo_price !== null ? (string) $this->promo_price : null,
            'discount_percent' => $this->discount_percent !== null ? (string) $this->discount_percent : null,
            'effective_price' => $this->effectivePrice($basePrice),
            'start_date' => $this->start_date?->toISOString(),
            'end_date' => $this->end_date?->toISOString(),
            'is_active' => $this->isActive(),
            'service' => new ServiceResource($this->whenLoaded('service')),
            'formation' => $this->whenLoaded('formation', fn () => [
                'id' => $this->formation?->id,
                'code' => $this->formation?->code,
                'name' => $this->formation?->name,
            ]),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
