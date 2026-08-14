<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreProspectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('prospects.creer') ?? false;
    }

    public function rules(): array
    {
        return [
            'commercial_id' => ['sometimes', 'nullable', 'string', 'exists:commercials,id'],
            'agency_id' => ['sometimes', 'nullable', 'string', 'exists:agencies,id'],
            'first_name' => ['required', 'string', 'max:150'],
            'last_name' => ['required', 'string', 'max:150'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'country' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'first_name.required' => 'Le prénom est obligatoire.',
            'last_name.required' => 'Le nom est obligatoire.',
        ];
    }
}
