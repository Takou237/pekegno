<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'name' => $this->name,
            'description' => $this->description,
            'brand' => $this->brand,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category?->id,
                'name' => $this->category?->name,
                'color' => $this->category?->color,
                'icon' => $this->category?->icon,
            ]),
            'purchase_price' => (float) $this->purchase_price,
            'selling_price' => (float) $this->selling_price,
            'price_with_tax' => $this->price_with_tax,
            'tax_rate' => (float) $this->tax_rate,
            'is_stock_managed' => $this->is_stock_managed,
            'is_active' => $this->is_active,
            'agency' => $this->whenLoaded('agency', fn () => [
                'id' => $this->agency?->id,
                'name' => $this->agency?->name,
                'code' => $this->agency?->code,
            ]),
            'availability' => $this->agency_id ? 'agency' : 'global',
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}