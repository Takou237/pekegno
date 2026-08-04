<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'formation_id' => ['required', 'uuid', 'exists:formations,id'],
            'trainer_id' => ['sometimes', 'nullable', 'uuid', 'exists:users,id'],
            'name' => ['required', 'string', 'max:255'],
            'order' => ['sometimes', 'integer', 'min:0'],
            'description' => ['sometimes', 'nullable', 'string'],
            'type' => ['required', 'string', 'in:video,pdf,cours,exercice,quiz'],
            'cover_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'video' => ['sometimes', 'nullable', 'string', 'max:255'],
            'pdf' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'formation_id.required' => 'La formation est obligatoire.',
            'formation_id.exists' => 'La formation sélectionnée est invalide.',
            'name.required' => 'Le nom du module est obligatoire.',
            'trainer_id.exists' => 'Le formateur sélectionné est invalide.',
            'type.required' => 'Le type du module est obligatoire.',
            'type.in' => 'Le type du module est invalide.',
        ];
    }
}
