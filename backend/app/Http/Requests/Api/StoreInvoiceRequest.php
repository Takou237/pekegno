<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
            'client_id' => ['nullable', 'uuid', 'exists:users,id'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'commercial_id' => ['nullable', 'uuid', 'exists:commercials,id'],
            'invoice_date' => ['nullable', 'date'],
            'payment_type' => ['nullable', 'in:cash,mobile'],
            'comment' => ['nullable', 'string', 'max:1000'],
            'advance' => ['nullable', 'numeric', 'min:0.01'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.service_id' => ['nullable', 'uuid', 'exists:services,id'],
            'items.*.label' => ['required_without:items.*.service_id', 'nullable', 'string', 'max:255'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' => 'La facture doit contenir au moins une ligne.',
            'items.*.label.required_without' => 'Chaque ligne doit avoir un libellé ou un service.',
            'items.*.quantity.min' => 'La quantité doit être d\'au moins 1.',
        ];
    }
}
