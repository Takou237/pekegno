<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class TwoFactorDisableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'password' => ['required', 'string'],
            'code' => ['required', 'string', 'size:6'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Le mot de passe est obligatoire.',
            'code.required' => 'Le code de vérification est obligatoire.',
            'code.size' => 'Le code de vérification doit contenir 6 caractères.',
        ];
    }
}
