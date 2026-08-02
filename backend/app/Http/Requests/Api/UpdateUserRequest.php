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
            'role_id' => ['sometimes', 'nullable', 'uuid', 'exists:roles,id'],
            'is_password_change_required' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'string', 'min:8', 'confirmed'],
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
                $assignable = EmployeeRoles::assignableRoleNames($this->user()?->role?->name);

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
            'username.unique' => "Ce nom d'utilisateur est déjà utilisé.",
            'email.unique' => 'Cet email est déjà utilisé.',
            'role_id.exists' => "Ce rôle n'existe pas.",
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
        ];
    }
}
