<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class ReorderModulesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order' => ['required', 'array', 'min:1'],
            'order.*' => ['required', 'uuid', 'distinct', 'exists:modules,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'order.required' => 'La liste des modules est obligatoire.',
            'order.*.exists' => 'Un module de la liste est invalide.',
        ];
    }
}
