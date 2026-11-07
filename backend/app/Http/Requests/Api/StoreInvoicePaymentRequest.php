<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvoicePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'in:cash,om,momo,wave,moov,bank'],
            'is_advance' => ['sometimes', 'boolean'],
            'paid_at' => ['nullable', 'date'],
            'received_at' => ['nullable', 'date'],
            'comment' => ['nullable', 'string', 'max:500'],
            'treasury_account_id' => ['nullable', 'uuid', 'exists:treasury_accounts,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.min' => 'Le montant doit être supérieur à 0.',
            'payment_method.in' => 'Le mode de paiement doit être cash, om, momo, wave, moov ou bank (le mode « mobile » générique ne permet pas de choisir la caisse).',
        ];
    }
}
