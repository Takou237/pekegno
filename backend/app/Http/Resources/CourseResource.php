<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'mode' => $this->mode,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category?->id,
                'name' => $this->category?->name,
                'color' => $this->category?->color,
                'icon' => $this->category?->icon,
            ]),
            'price' => (float) $this->price,
            'duration_hours' => $this->duration_hours,
            'agency' => $this->whenLoaded('agency', fn () => [
                'id' => $this->agency?->id,
                'name' => $this->agency?->name,
                'code' => $this->agency?->code,
            ]),
            'availability' => $this->agency_id ? 'agency' : 'global',
            'is_active' => $this->is_active,
            'sessions_count' => $this->whenCounted('sessions'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}