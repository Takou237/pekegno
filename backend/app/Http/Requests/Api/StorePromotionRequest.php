<?php

namespace App\Http\Requests\Api;

use App\Models\Promotion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePromotionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $service = $this->route('service');
        $promotion = $this->route('promotion');
        $serviceId = $service?->id ?? $promotion?->service_id;

        return [
            'type' => ['required', Rule::in(['amount', 'percent'])],
            'promo_price' => [
                'nullable',
                'numeric',
                'min:0',
                'required_if:type,amount',
                function ($attribute, $value, $fail) use ($service) {
                    if ($value !== null && $service !== null && (float) $value >= (float) $service->price) {
                        $fail('Le prix promotionnel doit être inférieur au prix du service.');
                    }
                },
            ],
            'discount_percent' => [
                'nullable',
                'numeric',
                'between:0.01,100',
                'required_if:type,percent',
            ],
            'start_date' => [
                'required',
                'date',
                function ($attribute, $value, $fail) use ($serviceId, $promotion) {
                    if ($serviceId === null) {
                        return;
                    }

                    $end = $this->input('end_date');

                    $overlap = Promotion::where('service_id', $serviceId)
                        ->when($promotion, fn ($q) => $q->where('id', '!=', $promotion->id))
                        ->where('start_date', '<', $end)
                        ->where('end_date', '>', $value)
                        ->exists();

                    if ($overlap) {
                        $fail('Une autre promotion chevauche déjà cette période pour ce service.');
                    }
                },
            ],
            'end_date' => ['required', 'date', 'after:start_date'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => 'Le type de promotion (amount ou percent) est obligatoire.',
            'type.in' => 'Le type doit être amount ou percent.',
            'promo_price.required_if' => 'Le prix promotionnel est obligatoire pour une promotion de type amount.',
            'promo_price.numeric' => 'Le prix promo doit être un nombre.',
            'promo_price.min' => 'Le prix promo ne peut pas être négatif.',
            'discount_percent.required_if' => 'Le pourcentage de réduction est obligatoire pour une promotion de type percent.',
            'discount_percent.between' => 'Le pourcentage doit être compris entre 0.01 et 100.',
            'start_date.required' => 'La date de début est obligatoire.',
            'end_date.required' => 'La date de fin est obligatoire.',
            'end_date.after' => 'La date de fin doit être strictement après la date de début.',
        ];
    }
}
