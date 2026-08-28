<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrainingSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'course' => $this->whenLoaded('course', fn () => [
                'id' => $this->course?->id,
                'code' => $this->course?->code,
                'name' => $this->course?->name,
                'mode' => $this->course?->mode,
            ]),
            'module' => $this->whenLoaded('module', fn () => $this->module ? [
                'id' => $this->module->id,
                'name' => $this->module->name,
                'order_index' => $this->module->order_index,
            ] : null),
            'trainer' => $this->whenLoaded('trainer', fn () => [
                'id' => $this->trainer?->id,
                'first_name' => $this->trainer?->first_name,
                'last_name' => $this->trainer?->last_name,
                'email' => $this->trainer?->email,
            ]),
            'agency' => $this->whenLoaded('agency', fn () => [
                'id' => $this->agency?->id,
                'name' => $this->agency?->name,
                'code' => $this->agency?->code,
            ]),
            'start_at' => $this->start_at?->toISOString(),
            'end_at' => $this->end_at?->toISOString(),
            'max_capacity' => $this->max_capacity,
            'price' => $this->price !== null ? (float) $this->price : null,
            'effective_price' => $this->effective_price,
            'status' => $this->status,
            'enrollments_count' => $this->enrollments_count ?? null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}