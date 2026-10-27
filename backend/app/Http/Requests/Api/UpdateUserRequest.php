<?php

namespace App\Http\Requests\Api;

use App\Models\Role;
use App\Models\User;
use App\Support\EmployeeRoles;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->route('user');

        return [
            'username' => ['sometimes', 'string', 'max:100', Rule::unique('users')->ignore($userId)],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users')->ignore($userId)],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
            'role_id' => ['sometimes', 'required', 'uuid', 'exists:roles,id'],
            'is_password_change_required' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'string', 'min:8', 'confirmed'],
            'country_id' => ['sometimes', 'nullable', 'uuid', 'exists:countries,id'],
            // Rattachement (agence + département optionnel) : n'est modifié que
            // si la clé agency_id est envoyée.
            'agency_id' => ['sometimes', 'nullable', 'uuid', 'exists:agencies,id'],
            'department_id' => ['sometimes', 'nullable', 'uuid', 'exists:departments,id'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->has('role_id')) {
                    return;
                }

                $roleId = $this->input('role_id');
                if (! $roleId) {
                    return;
                }

                $target = $this->route('user');
                if ($target instanceof User && $target->role_id === $roleId) {
                    return;
                }

                $roleName = Role::where('id', $roleId)->value('name');

                if (! EmployeeRoles::isAssignable($roleName ?? '', $this->user()?->role?->name)) {
                    $validator->errors()->add(
                        'role_id',
                        'Vous n\'êtes pas autorisé à attribuer ce rôle.'
                    );
                }
            },
            function (Validator $validator) {
                $departmentId = $this->input('department_id');
                if (! $departmentId) {
                    return;
                }

                $deptAgencyId = \App\Models\Department::where('id', $departmentId)->value('agency_id');
                $agencyId = $this->input('agency_id');

                if ($deptAgencyId && $agencyId && $deptAgencyId !== $agencyId) {
                    $validator->errors()->add(
                        'department_id',
                        'Le département sélectionné n\'appartient pas à l\'agence choisie.'
                    );
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'username.unique' => "Ce nom d'utilisateur est déjà utilisé.",
            'email.unique' => 'Cet email est déjà utilisé.',
            'role_id.required' => 'Le rôle est obligatoire.',
            'role_id.exists' => "Ce rôle n'existe pas.",
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
        ];
    }
}
