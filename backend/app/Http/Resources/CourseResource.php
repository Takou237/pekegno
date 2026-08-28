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
            'categories' => $this->whenLoaded('categories', fn () => $this->categories->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'color' => $c->color,
            ]) ?? []),
            'price' => (float) $this->price,
            'effective_price' => (float) $this->effective_price,
            'duration_hours' => $this->duration_hours,
            'duration_type' => $this->duration_type,
            'duration_months' => $this->duration_months,
            'objective' => $this->objective,
            'prerequisites' => $this->prerequisites,
            'cover_image' => $this->cover_image,
            'agency' => $this->whenLoaded('agency', fn () => [
                'id' => $this->agency?->id,
                'name' => $this->agency?->name,
                'code' => $this->agency?->code,
            ]),
            'availability' => $this->agency_id ? 'agency' : 'global',
            'is_active' => $this->is_active,
            'sessions_count' => $this->whenCounted('sessions'),
            'modules_count' => $this->whenCounted('modules'),
            'formation_enrollments_count' => $this->whenCounted('formationEnrollments'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}