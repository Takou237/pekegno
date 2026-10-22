<?php

namespace App\Http\Requests\Api;

use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;

class UpdateInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        $invoice = $this->route('invoice');

        return $invoice instanceof Invoice
            && $this->user() !== null
            && $invoice->created_by === $this->user()->id;
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
