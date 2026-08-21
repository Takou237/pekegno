<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAgencyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $agencyId = $this->route('agency')?->id ?? $this->route('agency');

        return [
            'code' => ['sometimes', 'string', 'max:20', 'unique:agencies,code,' . $agencyId],
            'name' => ['sometimes', 'string', 'max:255'],
            'country' => ['sometimes', 'string', 'max:100'],
            'country_id' => ['sometimes', 'nullable', 'uuid', 'exists:countries,id'],
            'city' => ['sometimes', 'nullable', 'string', 'max:150'],
            'address' => ['sometimes', 'nullable', 'string'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'activities' => ['sometimes', 'array'],
            'activities.*.type' => ['required', 'string', 'in:agency,academy'],
            'activities.*.is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'Ce code agence est déjà utilisé.',
        ];
    }
}
