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
            'seller_user_id' => ['nullable', 'uuid', 'exists:users,id'],
            'payment_type' => ['nullable', 'in:cash,om,momo,mobile'],
            'payer_phone' => ['nullable', 'required_if:payment_type,om,momo', 'string', 'max:50'],
            'invoice_date' => ['nullable', 'date'],
            'comment' => ['nullable', 'string', 'max:1000'],
            'advance' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items' => ['sometimes', 'required', 'array', 'min:1'],
            'items.*.id' => ['nullable', 'uuid', 'exists:invoice_items,id'],
            'items.*.service_id' => ['nullable', 'uuid', 'exists:services,id'],
            'items.*.product_id' => ['nullable', 'uuid', 'exists:products,id'],
            'items.*.label' => ['required_without_all:items.*.service_id,items.*.product_id', 'nullable', 'string', 'max:255'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.pass_tier' => ['nullable', 'in:classique,premium,vip'],
        ];
    }
}
