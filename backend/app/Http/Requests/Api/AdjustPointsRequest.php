<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class AdjustPointsRequest extends FormRequest
{
    public function authorize(): bool
    {
        $role = $this->user()?->role?->name;
        if (in_array($role, ['super-admin', 'direction-generale'], true)) {
            return true;
        }
        // Chefs : le périmètre (commercial de leur agence / département) est
        // vérifié dans CommercialController::adjustPoints.
        return in_array($role, ['responsable-agence', 'responsable-departement'], true);
    }

    public function rules(): array
    {
        return [
            'points' => ['required', 'integer', 'not_in:0'],
            'reason' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}