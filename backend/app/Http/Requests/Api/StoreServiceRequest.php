<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'category_id' => ['required', 'uuid', 'exists:categories,id'],
            'price' => ['required', 'numeric', 'min:0'],
            'agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'coverage' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'presentation_video' => ['nullable', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $agencyId = $this->input('agency_id');
            $departmentId = $this->input('department_id');

            if (! $agencyId && ! $departmentId) {
                $validator->errors()->add(
                    'agency_id',
                    'Un service doit appartenir à une agence ou à un département.'
                );
            }
        });
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Le nom du service est obligatoire.',
            'category_id.required' => 'La catégorie est obligatoire.',
            'category_id.exists' => 'La catégorie sélectionnée n\'existe pas.',
            'price.required' => 'Le prix est obligatoire.',
            'price.numeric' => 'Le prix doit être un nombre.',
            'price.min' => 'Le prix ne peut pas être négatif.',
            'agency_id.exists' => 'L\'agence sélectionnée n\'existe pas.',
            'department_id.exists' => 'Le département sélectionné n\'existe pas.',
        ];
    }
}
