<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEnrollmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('enrollments.creer') ?? false;
    }

    public function rules(): array
    {
        return [
            'session_id' => ['required', 'string', 'exists:training_sessions,id'],
            'learner_user_id' => ['required', 'string', 'exists:users,id'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $learner = \App\Models\User::find($this->input('learner_user_id'));

            if ($learner && $learner->role?->name !== 'client') {
                $validator->errors()->add('learner_user_id', "L'apprenant doit être un client (rôle « client »).");
            }
        });
    }
}