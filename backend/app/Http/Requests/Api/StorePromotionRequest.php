<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StorePromotionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'promo_price' => ['required', 'numeric', 'min:0'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ];
    }

    public function messages(): array
    {
        return [
            'promo_price.required' => 'Le prix promo est obligatoire.',
            'promo_price.numeric' => 'Le prix promo doit être un nombre.',
            'promo_price.min' => 'Le prix promo ne peut pas être négatif.',
            'start_date.required' => 'La date de début est obligatoire.',
            'end_date.required' => 'La date de fin est obligatoire.',
            'end_date.after_or_equal' => 'La date de fin doit être après la date de début.',
        ];
    }
}
