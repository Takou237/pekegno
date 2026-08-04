<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ModuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'formation_id' => $this->formation_id,
            'trainer_id' => $this->trainer_id,
            'name' => $this->name,
            'order' => $this->order,
            'description' => $this->description,
            'type' => $this->type,
            'cover_image' => $this->cover_image,
            'video' => $this->video,
            'pdf' => $this->pdf,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'trainer' => new UserResource($this->whenLoaded('trainer')),
        ];
    }
}
