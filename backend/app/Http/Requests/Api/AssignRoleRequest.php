<?php

namespace App\Http\Requests\Api;

use App\Models\Role;
use App\Support\EmployeeRoles;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class AssignRoleRequest extends FormRequest
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
            'role_id' => ['required', 'string', 'exists:roles,id'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $roleName = Role::where('id', $this->input('role_id'))->value('name');
                $assignable = EmployeeRoles::assignableRoleNames($this->user()?->role?->name);

                if (EmployeeRoles::isClient($roleName)) {
                    $validator->errors()->add(
                        'role_id',
                        'Le rôle client ne peut pas être attribué ici : les clients s\'inscrivent via la page d\'inscription.'
                    );

                    return;
                }

                if (! in_array($roleName, $assignable, true)) {
                    $validator->errors()->add(
                        'role_id',
                        'Vous n\'êtes pas autorisé à attribuer ce rôle.'
                    );
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'role_id.required' => 'Le rôle est obligatoire.',
            'role_id.exists' => "Ce rôle n'existe pas.",
        ];
    }
}
