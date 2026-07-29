<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('departments')->where(fn ($q) => $q->where('agency_id', $this->agency_id)),
            ],
            'description' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'agency_id.required' => "L'agence est obligatoire.",
            'agency_id.exists' => "Cette agence n'existe pas.",
            'name.required' => "Le nom du département est obligatoire.",
            'name.unique' => "Un département avec ce nom existe déjà dans cette agence.",
        ];
    }
}
