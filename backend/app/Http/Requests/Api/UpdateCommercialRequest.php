<?php

namespace App\Http\Requests\Api;

use App\Models\Commercial;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateCommercialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasAnyPermission(['commercials.modifier', 'employes.modifier']) ?? false;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['sometimes', 'nullable', 'string', 'exists:users,id'],
            'agency_id' => ['sometimes', 'nullable', 'string', 'exists:agencies,id'],
            'kind' => ['sometimes', 'in:commercial,employe'],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'email' => [
                'sometimes', 'nullable', 'email', 'max:255',
                // La liaison implicite de route donne ici le modèle Commercial, pas son id :
                // concaténer directement dans une règle string ('unique:...,'.$model) appelle
                // Model::__toString() (= le JSON complet de la ligne), ce qui corrompt le
                // parsing de la règle unique (erreur "Undefined array key"). Rule::unique()
                // gère nativement un modèle passé à ignore().
                Rule::unique('commercials', 'email')->ignore($this->route('commercial')),
            ],
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

                // "kind" est optionnel dans une requete de mise a jour (le formulaire
                // ne le renvoie pas forcement) : se rabattre sur le kind existant en
                // base plutot que de supposer "commercial" par defaut, sinon un compte
                // caissier lie a un profil employe est rejete a tort.
                $kind = $this->input('kind') ?? $this->route('commercial')?->kind;
                $allowedRoles = $kind === 'employe' ? ['commercial', 'caissier'] : ['commercial'];
                $user = User::with('role')->find($userId);

                if (! $user || ! in_array($user->role?->name, $allowedRoles, true)) {
                    $validator->errors()->add('user_id', 'Le compte lié doit avoir le rôle commercial ou caissier.');
                }

                if ($user && Commercial::where('user_id', $userId)
                    ->where('id', '!=', $this->route('commercial')?->id)
                    ->exists()) {
                    $validator->errors()->add('user_id', 'Ce compte est déjà lié à un autre profil commercial.');
                }
            },
        ];
    }
}
