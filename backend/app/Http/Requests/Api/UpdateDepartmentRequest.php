<?php

namespace App\Http\Requests\Api;

use App\Models\Department;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDepartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $department = $this->route('department');

        return [
            'agency_id' => ['sometimes', 'string', 'exists:agencies,id'],
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('departments')
                    ->ignore($department)
                    ->where(fn ($q) => $q->where('agency_id', $this->agency_id ?? $department?->agency_id)),
            ],
            'type' => ['sometimes', 'string', Rule::in(Department::TYPES)],
            'description' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'agency_id.exists' => "Cette agence n'existe pas.",
            'name.unique' => "Un département avec ce nom existe déjà dans cette agence.",
            'type.in' => "Le type doit être academy, agency, store ou studio.",
        ];
    }
}
