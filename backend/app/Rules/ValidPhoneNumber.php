<?php

namespace App\Rules;

use App\Models\Country;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * T8.4 : téléphone au format international, cohérent avec le pays choisi
 * (Cameroun +237, Côte d'Ivoire +225…). Sans pays, on accepte un numéro
 * international ou local de 6 à 15 chiffres.
 */
class ValidPhoneNumber implements ValidationRule
{
    private ?Country $country;

    public function __construct(?string $countryId = null, ?string $countryName = null)
    {
        $this->country = $this->resolveCountry($countryId, $countryName);
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $phone = trim((string) $value);

        if ($phone === '') {
            return;
        }

        if (! preg_match('/^\+?[0-9\s().-]+$/', $phone)) {
            $fail('Le numéro de téléphone ne doit contenir que des chiffres, espaces, +, -, points ou parenthèses.');

            return;
        }

        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (strlen($digits) < 6 || strlen($digits) > 15) {
            $fail('Le numéro de téléphone doit contenir entre 6 et 15 chiffres.');

            return;
        }

        $phoneCode = $this->country?->phone_code;
        if (! $phoneCode) {
            return;
        }

        $codeDigits = preg_replace('/\D+/', '', $phoneCode) ?? '';

        if (str_starts_with($phone, '+')) {
            if ($codeDigits !== '' && ! str_starts_with($digits, $codeDigits)) {
                $fail("Le numéro doit commencer par l'indicatif du pays ({$phoneCode}).");

                return;
            }

            $local = $codeDigits !== '' ? substr($digits, strlen($codeDigits)) : $digits;

            if (strlen($local) < 6 || strlen($local) > 12) {
                $fail("Le numéro local doit contenir entre 6 et 12 chiffres après l'indicatif {$phoneCode}.");
            }
        }
    }

    private function resolveCountry(?string $countryId, ?string $countryName): ?Country
    {
        if ($countryId) {
            $country = Country::find($countryId);
            if ($country) {
                return $country;
            }
        }

        if ($countryName) {
            $name = trim($countryName);

            return Country::query()
                ->whereRaw('lower(name) = ?', [mb_strtolower($name)])
                ->orWhereRaw('lower(code) = ?', [mb_strtolower($name)])
                ->orWhereRaw('lower(iso_code) = ?', [mb_strtolower($name)])
                ->first();
        }

        return null;
    }
}
