<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('clients.modifier') ?? false;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', 'unique:users,email,'.$this->route('client')],
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
}