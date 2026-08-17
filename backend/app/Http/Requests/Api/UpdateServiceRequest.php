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
            'category_id' => ['sometimes', 'required', 'uuid', 'exists:categories,id'],
            'agency_id' => ['sometimes', 'required', 'uuid', 'exists:agencies,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'is_seminar' => ['sometimes', 'boolean'],
            'tiers' => ['sometimes', 'array', 'max:3'],
            'tiers.*.tier' => ['required', 'in:classique,premium,vip'],
            'tiers.*.label' => ['required', 'string', 'max:255'],
            'tiers.*.price' => ['required', 'numeric', 'min:0'],
            'tiers.*.description' => ['sometimes', 'nullable', 'string'],
            'cover_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'presentation_video' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Le nom du service est obligatoire.',
            'category_id.required' => 'La catégorie est obligatoire.',
            'category_id.exists' => 'La catégorie sélectionnée est invalide.',
            'agency_id.required' => "L'agence est obligatoire.",
            'agency_id.exists' => "L'agence sélectionnée est invalide.",
            'price.required' => 'Le prix est obligatoire.',
            'price.numeric' => 'Le prix doit être un nombre.',
        ];
    }
}
