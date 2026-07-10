<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreDepartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'agency_id' => ['required', 'string', 'exists:agencies,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'manager_id' => ['sometimes', 'nullable', 'string', 'exists:users,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'agency_id.required' => "L'agence est obligatoire.",
            'agency_id.exists' => "Cette agence n'existe pas. Utilisez un UUID valide récupéré depuis GET /api/agencies.",
            'name.required' => "Le nom du département est obligatoire.",
            'manager_id.exists' => "Ce gestionnaire n'existe pas.",
        ];
    }
}
