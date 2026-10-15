<?php

namespace App\Http\Requests\Api;

use App\Models\Department;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDepartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Le contrôle fin (chef de SA agence / SON département) est fait par
        // DepartmentPolicy::update via $this->authorize() dans le contrôleur.
        // Ici : hors direction, on refuse seulement les départements et les
        // transferts d'agence hors périmètre.
        $user = $this->user();
        if (in_array($user?->role?->name, ['super-admin', 'direction-generale'], true)) {
            return true;
        }
        $agencyIds = app(\App\Services\ScopeService::class)->agencyIds($user) ?? [];
        $department = $this->route('department');
        $agencyId = $department instanceof \App\Models\Department ? $department->agency_id : null;
        if ($agencyId && ! in_array($agencyId, $agencyIds, true)) {
            return false;
        }
        $targetAgencyId = $this->input('agency_id');
        if ($targetAgencyId && ! in_array($targetAgencyId, $agencyIds, true)) {
            return false;
        }

        return true;
    }

    public function rules(): array
    {
        $department = $this->route('department');

        return [
            'agency_id' => ['sometimes', 'string', 'exists:agencies,id'],
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('departments')
                    ->ignore($department)
                    ->where(fn ($q) => $q->where('agency_id', $this->agency_id ?? $department?->agency_id)),
            ],
            'type' => ['sometimes', 'string', Rule::in(Department::TYPES)],
            'description' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'agency_id.exists' => "Cette agence n'existe pas.",
            'name.unique' => "Un département avec ce nom existe déjà dans cette agence.",
            'type.in' => "Le type doit être academy, agency, store ou studio.",
        ];
    }
}
