<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role?->name, [
            'super-admin',
            'direction-generale',
            'responsable-agence',
            'responsable-departement',
        ], true);
    }

    public function rules(): array
    {
        return [
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'is_active.boolean' => 'Le statut actif doit être un booléen.',
        ];
    }
}
