<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_id' => ['nullable', 'uuid', 'exists:users,id'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'commercial_id' => ['nullable', 'uuid', 'exists:commercials,id'],
            'payment_type' => ['nullable', 'in:cash,om,momo,mobile'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
