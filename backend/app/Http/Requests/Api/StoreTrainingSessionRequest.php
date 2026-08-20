<?php

namespace App\Http\Requests\Api;

use App\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTrainingSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('sessions.creer') ?? false;
    }

    public function rules(): array
    {
        return [
            'course_id' => ['required', 'string', 'exists:courses,id'],
            'trainer_user_id' => ['sometimes', 'nullable', 'string', 'exists:users,id'],
            'agency_id' => ['sometimes', 'nullable', 'string', Rule::exists('agencies', 'id')->whereNull('deleted_at')],
            'start_at' => ['required', 'date'],
            'end_at' => ['sometimes', 'nullable', 'date', 'after:start_at'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'max_capacity' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', 'string', Rule::in(['planned', 'ongoing', 'completed', 'cancelled'])],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (! $this->filled('trainer_user_id')) {
                return;
            }

            $trainer = \App\Models\User::find($this->input('trainer_user_id'));

            if ($trainer && $trainer->role?->name !== 'formateur') {
                $validator->errors()->add('trainer_user_id', "Le formateur sélectionné doit avoir le rôle « formateur ».");
            }
        });
    }
}