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
            'name' => $this->name,
            'description' => $this->description,
            'price' => $this->price,
            'coverage' => $this->coverage,
            'presentation_video' => $this->presentation_video,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'color' => $this->category->color,
                'icon' => $this->category->icon,
            ]),
            'agency_id' => $this->agency_id,
            'agency' => $this->whenLoaded('agency', fn () => $this->agency ? [
                'id' => $this->agency->id,
                'name' => $this->agency->name,
            ] : null),
            'department_id' => $this->department_id,
            'department' => $this->whenLoaded('department', fn () => $this->department ? [
                'id' => $this->department->id,
                'name' => $this->department->name,
            ] : null),
            'current_price' => $this->current_price,
            'has_active_promotion' => $this->has_active_promotion,
            'active_promotion' => $this->whenLoaded('activePromotion', fn () => $this->activePromotion->first()
                ? new PromotionResource($this->activePromotion->first())
                : null),
            'promotions' => PromotionResource::collection($this->whenLoaded('promotions')),
            'price_history' => PriceHistoryResource::collection($this->whenLoaded('priceHistory')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'deleted_at' => $this->deleted_at?->toISOString(),
        ];
    }
}
