<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('products.creer') ?? false;
    }

    public function rules(): array
    {
        return [
            'sku' => ['sometimes', 'nullable', 'string', 'max:50', 'unique:products,sku'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string'],
            'category_id' => ['sometimes', 'nullable', 'string', 'exists:categories,id'],
            'brand' => ['sometimes', 'nullable', 'string', 'max:100'],
            'purchase_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'tax_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'is_stock_managed' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'agency_id' => ['sometimes', 'nullable', 'string', Rule::exists('agencies', 'id')->whereNull('deleted_at')],
        ];
    }
}