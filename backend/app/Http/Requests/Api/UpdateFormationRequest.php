<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFormationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['sometimes', 'required', 'string', 'in:presentiel,distanciel'],
            'duration' => ['sometimes', 'nullable', 'string', 'max:50'],
            'conditions' => ['sometimes', 'nullable', 'string'],
            'deposit_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'installments_count' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'online_payment' => ['sometimes', 'nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => 'Le type de formation est obligatoire.',
            'type.in' => 'Le type de formation doit être "presentiel" ou "distanciel".',
        ];
    }
}
