<?php

namespace App\Http\Requests\Api;

use App\Models\Role;
use App\Support\EmployeeRoles;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role?->name, [
            'super-admin',
            'direction-generale',
            'responsable-agence',
        ], true);
    }

    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:100', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'confirmed'],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'role_id' => ['sometimes', 'nullable', 'string', 'exists:roles,id'],
            'agency_id' => ['sometimes', 'nullable', 'string', 'exists:agencies,id'],
            'department_id' => ['sometimes', 'nullable', 'string', 'exists:departments,id'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $roleId = $this->input('role_id');
                if (! $roleId) {
                    return;
                }

                $roleName = Role::where('id', $roleId)->value('name');
                $assignable = EmployeeRoles::assignableRoleNames($this->user()?->role?->name);

                if ($roleName === null) {
                    $validator->errors()->add('role_id', "Ce rôle n'existe pas.");

                    return;
                }

                if (! in_array($roleName, $assignable, true)) {
                    $validator->errors()->add(
                        'role_id',
                        'Vous n\'êtes pas autorisé à attribuer ce rôle.'
                    );
                }
            },
            function (Validator $validator) {
                $agencyId = $this->input('agency_id');
                $departmentId = $this->input('department_id');

                if (! $departmentId) {
                    return;
                }

                $dept = \App\Models\Department::where('id', $departmentId)->first();

                if ($dept && $agencyId && $dept->agency_id !== $agencyId) {
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
            'username.required' => "Le nom d'utilisateur est obligatoire.",
            'username.unique' => "Ce nom d'utilisateur est déjà utilisé.",
            'email.required' => "L'email est obligatoire.",
            'email.unique' => 'Cet email est déjà utilisé.',
            'password.required' => 'Le mot de passe est obligatoire.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
        ];
    }
}
