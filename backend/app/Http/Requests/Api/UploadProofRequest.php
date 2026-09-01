<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UploadProofRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:jpeg,png,gif,webp,pdf', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Aucun fichier fourni.',
            'file.mimes' => 'La preuve doit être au format JPEG, PNG, GIF, WebP ou PDF.',
            'file.max' => 'Le fichier ne doit pas dépasser 10 Mo.',
        ];
    }
}
