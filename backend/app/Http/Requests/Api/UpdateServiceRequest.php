<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\Validator;
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
            'agency_id' => ['sometimes', 'nullable', 'uuid', 'exists:agencies,id'],
            'department_id' => ['sometimes', 'nullable', 'uuid', 'exists:departments,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'cover_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'presentation_video' => ['sometimes', 'nullable', 'string', 'max:255'],
            'formation' => ['sometimes', 'nullable', 'array'],
            'formation.type' => ['required_with:formation', 'string', 'in:presentiel,distanciel'],
            'formation.duration' => ['sometimes', 'nullable', 'string', 'max:50'],
            'formation.conditions' => ['sometimes', 'nullable', 'string'],
            'formation.deposit_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'formation.installments_count' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'formation.online_payment' => ['sometimes', 'nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Le nom du service est obligatoire.',
            'category_id.required' => 'La catégorie est obligatoire.',
            'category_id.exists' => 'La catégorie sélectionnée est invalide.',
            'price.required' => 'Le prix est obligatoire.',
            'price.numeric' => 'Le prix doit être un nombre.',
            'agency_id.exists' => "L'agence sélectionnée est invalide.",
            'department_id.exists' => 'Le département sélectionné est invalide.',
            'formation.type.in' => 'Le type de formation doit être "presentiel" ou "distanciel".',
        ];
    }

    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $agency = $this->filled('agency_id');
            $department = $this->filled('department_id');

            if ($agency && $department) {
                $validator->errors()->add(
                    'agency_id',
                    'Un service ne peut pas être rattaché à la fois à une agence et à un département.'
                );
            }
        });
    }
}
