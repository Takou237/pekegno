<?php

namespace App\Http\Requests\Api;

use App\Models\Trainer;
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
            'module_id' => ['sometimes', 'nullable', 'string', Rule::exists('course_modules', 'id')->whereNull('deleted_at')],
            'trainer_id' => ['sometimes', 'nullable', 'string', Rule::exists('trainers', 'id')->whereNull('deleted_at')],
            'agency_id' => ['sometimes', 'nullable', 'string', Rule::exists('agencies', 'id')->whereNull('deleted_at')],
            'start_at' => ['required', 'date'],
            'end_at' => ['sometimes', 'nullable', 'date', 'after:start_at'],
            'max_capacity' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', 'string', Rule::in(['planned', 'ongoing', 'completed', 'cancelled'])],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (! $this->filled('trainer_id')) {
                return;
            }

            $trainer = Trainer::find($this->input('trainer_id'));

            if ($trainer && ! $trainer->is_active) {
                $validator->errors()->add('trainer_id', 'Le formateur sélectionné est inactif.');
            }
        });
    }
}
