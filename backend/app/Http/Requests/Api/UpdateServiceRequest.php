<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'category_id' => ['sometimes', 'uuid', 'exists:categories,id'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'agency_id' => ['sometimes', 'nullable', 'uuid', 'exists:agencies,id'],
            'department_id' => ['sometimes', 'nullable', 'uuid', 'exists:departments,id'],
            'coverage' => ['sometimes', 'nullable', 'string', 'max:50'],
            'description' => ['sometimes', 'nullable', 'string'],
            'presentation_video' => ['sometimes', 'nullable', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.string' => 'Le nom du service est invalide.',
            'category_id.exists' => 'La catégorie sélectionnée n\'existe pas.',
            'price.numeric' => 'Le prix doit être un nombre.',
            'price.min' => 'Le prix ne peut pas être négatif.',
            'agency_id.exists' => 'L\'agence sélectionnée n\'existe pas.',
            'department_id.exists' => 'Le département sélectionné n\'existe pas.',
        ];
    }
}
