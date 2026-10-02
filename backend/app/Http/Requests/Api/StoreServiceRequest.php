<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isSeminar = (bool) $this->boolean('is_seminar');

        return [
            'code' => ['sometimes', 'nullable', 'string', 'max:50', 'unique:services,code'],
            'category_id' => ['required', 'uuid', 'exists:categories,id'],
            // L'agence n'est plus choisie dans le formulaire : le service est créé
            // dans les agences des pays cochés (plus l'agence de la page, si fournie).
            'agency_id' => ['required_without:target_country_ids', 'nullable', 'uuid', 'exists:agencies,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'price' => $isSeminar
                ? ['sometimes', 'nullable', 'numeric', 'min:0']
                : ['required', 'numeric', 'min:0'],
            // Prime fixe par vente : sans cette règle, validated() l'écartait et
            // la valeur saisie dans le formulaire n'était jamais enregistrée.
            'bonus_fixed' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'is_seminar' => ['sometimes', 'boolean'],
            // Déploiement : le service est aussi créé dans toutes les agences
            // des pays sélectionnés (comme les formations).
            'target_country_ids' => ['required_without:agency_id', 'array'],
            'target_country_ids.*' => ['uuid', 'exists:countries,id'],
            'is_public' => ['sometimes', 'boolean'],
            'tiers' => ['sometimes', 'array', 'max:3'],
            'tiers.*.tier' => ['required', 'in:classique,premium,vip'],
            'tiers.*.label' => ['required', 'string', 'max:255'],
            'tiers.*.price' => ['required', 'numeric', 'min:0'],
            'tiers.*.description' => ['sometimes', 'nullable', 'string'],
            'cover_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'presentation_video' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Le nom du service est obligatoire.',
            'category_id.required' => 'La catégorie est obligatoire.',
            'category_id.exists' => 'La catégorie sélectionnée est invalide.',
            'agency_id.required_without' => 'Cochez au moins un pays où créer le service.',
            'target_country_ids.required_without' => 'Cochez au moins un pays où créer le service.',
            'agency_id.exists' => "L'agence sélectionnée est invalide.",
            'price.required' => 'Le prix est obligatoire.',
            'price.numeric' => 'Le prix doit être un nombre.',
        ];
    }
}
