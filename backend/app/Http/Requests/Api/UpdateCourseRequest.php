<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('courses.modifier') ?? false;
    }

    public function rules(): array
    {
        return [
            'code' => ['sometimes', 'nullable', 'string', 'max:50', 'unique:courses,code,'.$this->route('course')],
            'name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string'],
            'objective' => ['sometimes', 'nullable', 'string'],
            'prerequisites' => ['sometimes', 'nullable', 'string'],
            'mode' => ['sometimes', 'string', Rule::in(['online', 'in_person', 'mixed'])],
            'category_ids' => ['sometimes', 'array'],
            'category_ids.*' => ['string', 'exists:course_categories,id'],
            'price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'duration_hours' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'duration_type' => ['sometimes', 'string', Rule::in(['limited', 'unlimited'])],
            'duration_months' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'cover_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'presentation_video' => ['sometimes', 'nullable', 'string', 'max:255'],
            'agency_id' => ['sometimes', 'nullable', 'string', Rule::exists('agencies', 'id')->whereNull('deleted_at')],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}