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
            // Preuves d'exécution : image ou document (publication, facture, rapport...).
            // Les couvertures restent filtrées côté UI (accept=image/*).
            'file' => ['required', 'file', 'mimes:jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,txt,csv,mp4,mov,mp3', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Aucun fichier fourni.',
            'file.mimes' => 'Format accepté : image (JPEG, PNG, GIF, WebP) ou document (PDF, DOC, XLS, TXT, CSV, MP4, MP3).',
            'file.max' => 'Le fichier ne doit pas dépasser 10 Mo.',
        ];
    }
}
