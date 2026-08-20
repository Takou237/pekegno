<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('clients.creer') ?? false;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:150'],
            'last_name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'confirmed'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'country' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'client_category_id' => ['sometimes', 'nullable', 'string', 'exists:client_categories,id'],
            'status' => ['sometimes', 'nullable', 'string', Rule::in(['lead', 'learning', 'active', 'inactive', 'former'])],
            'country_id' => ['sometimes', 'nullable', 'string', 'exists:countries,id'],
            'city_id' => ['sometimes', 'nullable', 'string', 'exists:cities,id'],
            'registered_agency_id' => ['sometimes', 'nullable', 'string', 'exists:agencies,id'],
            'commercial_user_id' => ['sometimes', 'nullable', 'string', 'exists:users,id'],
            'registered_at' => ['sometimes', 'nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'first_name.required' => 'Le prénom est obligatoire.',
            'last_name.required' => 'Le nom est obligatoire.',
            'email.required' => "L'email est obligatoire.",
            'email.unique' => 'Cet email est déjà utilisé.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
        ];
    }
}