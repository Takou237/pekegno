<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class SyncRolePermissionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role?->name, ['super-admin', 'direction-generale']);
    }

    public function rules(): array
    {
        return [
            'permissions' => ['required', 'array'],
            'permissions.*' => ['uuid', 'exists:permissions,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'permissions.required' => 'La liste des permissions est obligatoire.',
            'permissions.*.exists' => 'Une des permissions sélectionnées est invalide.',
        ];
    }
}
