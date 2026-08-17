<?php

namespace App\Http\Requests\Api;

use App\Models\Commercial;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreCommercialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasAnyPermission(['commercials.creer', 'employes.creer']) ?? false;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['sometimes', 'nullable', 'string', 'exists:users,id'],
            'agency_id' => ['sometimes', 'nullable', 'string', 'exists:agencies,id'],
            'kind' => ['sometimes', 'in:commercial,employe'],
            'first_name' => ['required', 'string', 'max:150'],
            'last_name' => ['required', 'string', 'max:150'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', 'unique:commercials,email'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'commission_type' => ['sometimes', 'in:none,percent,fixed'],
            'commission_value' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999999999'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $userId = $this->input('user_id');
                if (! $userId) {
                    return;
                }

                $allowedRoles = $this->input('kind') === 'employe' ? ['commercial', 'caissier'] : ['commercial'];
                $user = User::with('role')->find($userId);

                if (! $user || ! in_array($user->role?->name, $allowedRoles, true)) {
                    $validator->errors()->add('user_id', 'Le compte lié doit avoir le rôle commercial ou caissier.');
                }

                if ($user && Commercial::where('user_id', $userId)->exists()) {
                    $validator->errors()->add('user_id', 'Ce compte est déjà lié à un profil commercial.');
                }
            },
        ];
    }
}
