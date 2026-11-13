<?php

namespace App\Http\Requests\Api;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Rules\ValidPhoneNumber;

class StoreClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('clients.creer') ?? false;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:150'],
            'last_name' => ['required', 'string', 'max:150'],
            // Optionnel : un apprenant inscrit au guichet n'a pas toujours d'email.
            // ClientController::store génère un email de connexion de secours si absent.
            // L6 : la règle `email` de Laravel (RFC) accepte un domaine sans point
            // (« client@exemple ») ; on exige donc une extension réelle.
            'email' => [
                'sometimes', 'nullable', 'email', 'max:255', 'unique:users,email',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (is_string($value) && $value !== '' && ! preg_match('/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/', $value)) {
                        $fail("Le format de l'email est invalide.");
                    }
                },
            ],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50', new ValidPhoneNumber($this->input('country_id'), $this->input('country'))],
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'confirmed'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'country' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'nationality' => ['sometimes', 'nullable', 'string', 'max:100'],
            'quartier' => ['sometimes', 'nullable', 'string', 'max:150'],
            'occupation' => ['sometimes', 'nullable', 'string', 'max:150'],
            'is_active' => ['sometimes', 'boolean'],
            'client_category_id' => ['sometimes', 'nullable', 'string', 'exists:client_categories,id'],
            'status' => ['sometimes', 'nullable', 'string', Rule::in(['lead', 'learning', 'active', 'inactive', 'former'])],
            'country_id' => ['sometimes', 'nullable', 'string', 'exists:countries,id'],
            'city_id' => ['sometimes', 'nullable', 'string', 'exists:cities,id'],
            'registered_agency_id' => ['sometimes', 'nullable', 'string', 'exists:agencies,id'],
            'commercial_user_id' => ['sometimes', 'nullable', 'string', 'exists:users,id'],
            'registered_at' => ['sometimes', 'nullable', 'date'],
            // T8.3 : le premier envoi renvoie 409 avec les clients similaires ;
            // le formulaire peut confirmer en renvoyant allow_duplicate=true.
            'allow_duplicate' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'first_name.required' => 'Le prénom est obligatoire.',
            'last_name.required' => 'Le nom est obligatoire.',
            'email.required' => "L'email est obligatoire.",
            'email.unique' => 'Cet email est déjà utilisé.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
        ];
    }
}