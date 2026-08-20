<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EnrollmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'session' => $this->whenLoaded('session', fn () => [
                'id' => $this->session?->id,
                'start_at' => $this->session?->start_at?->toISOString(),
                'status' => $this->session?->status,
                'course' => $this->session?->course ? [
                    'id' => $this->session->course->id,
                    'code' => $this->session->course->code,
                    'name' => $this->session->course->name,
                ] : null,
            ]),
            'learner' => $this->whenLoaded('learner', fn () => [
                'id' => $this->learner?->id,
                'client_number' => $this->learner?->client_number,
                'first_name' => $this->learner?->first_name,
                'last_name' => $this->learner?->last_name,
                'email' => $this->learner?->email,
            ]),
            'status' => $this->status,
            'attendance' => $this->attendance,
            'attended_at' => $this->attended_at?->toISOString(),
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}