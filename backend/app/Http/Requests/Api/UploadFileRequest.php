<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UploadFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'image', 'mimes:jpeg,png,gif,webp', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Aucun fichier fourni.',
            'file.image' => 'Le fichier doit être une image.',
            'file.mimes' => 'Le fichier doit être au format JPEG, PNG, GIF ou WebP.',
            'file.max' => 'L\'image ne doit pas dépasser 5 Mo.',
        ];
    }
}
