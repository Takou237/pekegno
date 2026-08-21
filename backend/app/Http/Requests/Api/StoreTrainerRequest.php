<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreTrainerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('sessions.creer') ?? false;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required_without:last_name', 'nullable', 'string', 'max:150'],
            'last_name' => ['required_without:first_name', 'nullable', 'string', 'max:150'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'bio' => ['sometimes', 'nullable', 'string'],
            'agency_id' => ['sometimes', 'nullable', 'string', 'exists:agencies,id'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
