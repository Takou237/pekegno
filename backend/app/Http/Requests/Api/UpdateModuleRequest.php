<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'trainer_id' => ['sometimes', 'nullable', 'uuid', 'exists:users,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'order' => ['sometimes', 'integer', 'min:0'],
            'description' => ['sometimes', 'nullable', 'string'],
            'type' => ['sometimes', 'required', 'string', 'in:video,pdf,cours,exercice,quiz'],
            'cover_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'video' => ['sometimes', 'nullable', 'string', 'max:255'],
            'pdf' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Le nom du module est obligatoire.',
            'trainer_id.exists' => 'Le formateur sélectionné est invalide.',
            'type.required' => 'Le type du module est obligatoire.',
            'type.in' => 'Le type du module est invalide.',
        ];
    }
}
