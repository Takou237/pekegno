<?php

namespace App\Support;

use App\Models\Country;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Regroupe les pays et villes saisis en texte libre sur les fiches clients
 * (« Cameroun », « Cameroon », « CAMEROUN » ; « Douala », « DOUALA »,
 * « Douala - Cité SIC »…), pour les classements par pays et par ville (B27)
 * et le filtre des clients par ville.
 */
final class PlaceName
{
    /** Variantes courantes → code pays de la fiche pays. */
    private const COUNTRY_ALIASES = [
        'cameroon' => 'CMR',
        'camerounais' => 'CMR',
        'camerounaise' => 'CMR',
        'ivory coast' => 'CIV',
        'cote divoire' => 'CIV',
        'ivoirien' => 'CIV',
        'ivoirienne' => 'CIV',
    ];

    /** Clé de comparaison : sans accents, minuscules, ponctuation retirée. */
    public static function key(?string $value): string
    {
        $value = Str::ascii(trim((string) $value));
        // « Douala - Cité SIC » : la ville est avant le tiret.
        $value = preg_split('/\s+-\s+/', $value)[0];
        $value = preg_replace('/[^a-z0-9 ]+/', '', mb_strtolower($value));

        return trim(preg_replace('/\s+/', ' ', $value));
    }

    /** Nom de pays officiel (fiche pays) pour un texte libre, sinon le texte nettoyé. */
    public static function countryResolver(): \Closure
    {
        $countries = Country::query()->get(['name', 'code', 'iso_code']);
        $byKey = [];
        foreach ($countries as $country) {
            $byKey[self::key($country->name)] = $country->name;
            foreach ([$country->code, $country->iso_code] as $code) {
                if ($code) {
                    $byKey[self::key($code)] = $country->name;
                }
            }
        }
        $byCode = $countries->filter(fn ($c) => $c->code)->mapWithKeys(fn ($c) => [strtoupper($c->code) => $c->name]);

        return function (?string $value) use ($byKey, $byCode): ?string {
            $key = self::key($value);
            if ($key === '') {
                return null;
            }
            if (isset($byKey[$key])) {
                return $byKey[$key];
            }
            $code = self::COUNTRY_ALIASES[$key] ?? null;

            return ($code ? $byCode[$code] ?? null : null) ?? Str::title(trim((string) $value));
        };
    }

    /**
     * Classement : regroupe les valeurs par clé, affiche la graphie la plus
     * fréquente, du plus grand au plus petit.
     *
     * @param  Collection<int, string|null>  $values
     * @return Collection<int, array{name: string, count: int}>
     */
    public static function rank(Collection $values, string $unknown): Collection
    {
        return $values
            ->groupBy(fn ($v) => self::key($v) ?: '')
            ->map(function (Collection $group, string $key) use ($unknown) {
                $name = $key === ''
                    ? $unknown
                    : $group->countBy()->sortDesc()->keys()->first();

                return ['name' => trim((string) $name), 'count' => $group->count()];
            })
            ->sortByDesc('count')
            ->values();
    }
}
