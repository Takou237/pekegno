<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class TwoFactorLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'temp_token' => ['required', 'string'],
            'code' => ['required', 'string', 'size:6'],
        ];
    }

    public function messages(): array
    {
        return [
            'temp_token.required' => 'Le token temporaire est obligatoire.',
            'code.required' => 'Le code de vérification est obligatoire.',
            'code.size' => 'Le code de vérification doit contenir 6 caractères.',
        ];
    }
}
