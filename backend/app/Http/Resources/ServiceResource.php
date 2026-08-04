<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'agency_id' => $this->agency_id,
            'category_id' => $this->category_id,
            'name' => $this->name,
            'description' => $this->description,
            'price' => (string) $this->price,
            'effective_price' => (string) $this->effective_price,
            'cover_image' => $this->cover_image,
            'presentation_video' => $this->presentation_video,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'deleted_at' => $this->deleted_at?->toISOString(),
            'category' => new CategoryResource($this->whenLoaded('category')),
            'agency' => new AgencyResource($this->whenLoaded('agency')),
            'promotions' => PromotionResource::collection($this->whenLoaded('promotions')),
            'price_history' => PriceHistoryResource::collection($this->whenLoaded('priceHistory')),
        ];
    }
}
