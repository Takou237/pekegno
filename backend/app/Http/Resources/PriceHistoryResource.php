<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PriceHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'service_id' => $this->service_id,
            'price' => $this->price,
            'changed_by' => $this->changed_by,
            'changed_by_name' => $this->whenLoaded('changedBy', fn () => $this->changedBy?->first_name
                ? trim($this->changedBy->first_name.' '.$this->changedBy->last_name)
                : ($this->changedBy?->username ?? null)),
            'reason' => $this->reason,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
