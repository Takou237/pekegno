<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProspectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('prospects.modifier') ?? false;
    }

    public function rules(): array
    {
        return [
            'commercial_id' => ['sometimes', 'nullable', 'string', 'exists:commercials,id'],
            'agency_id' => ['sometimes', 'nullable', 'string', 'exists:agencies,id'],
            'first_name' => ['sometimes', 'required', 'string', 'max:150'],
            'last_name' => ['sometimes', 'required', 'string', 'max:150'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'country' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }
}
