<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreAgencyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:20', 'unique:agencies,code'],
            'name' => ['required', 'string', 'max:255'],
            'country' => ['required', 'string', 'max:100'],
            'city' => ['sometimes', 'nullable', 'string', 'max:150'],
            'address' => ['sometimes', 'nullable', 'string'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'manager_id' => ['sometimes', 'nullable', 'string', 'exists:users,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.required' => 'Le code agence est obligatoire.',
            'code.unique' => 'Ce code agence est déjà utilisé.',
            'name.required' => "Le nom de l'agence est obligatoire.",
            'country.required' => 'Le pays est obligatoire.',
            'manager_id.exists' => "Ce gestionnaire n'existe pas.",
        ];
    }
}
