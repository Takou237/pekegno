<?php

namespace App\Support;

use App\Models\TreasuryAccount;
use Closure;
use Illuminate\Support\Str;

/**
 * Moyens de paiement : une caisse = un moyen de paiement.
 *
 * Les moyens standard (espèces, Orange Money, MTN MoMo, Wave, Moov, banque)
 * existent toujours ; chaque caisse créée par l'administration ajoute le sien
 * (sa `method_key`), proposé dans les formulaires et ventilé dans les tableaux.
 */
final class PaymentMethods
{
    /** @var array<string, array{label: string, code: string, type: string}> */
    public const STANDARD = [
        'cash' => ['label' => 'Espèces', 'code' => 'C', 'type' => TreasuryAccount::TYPE_CASH],
        'om' => ['label' => 'Orange Money', 'code' => 'O', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY],
        'momo' => ['label' => 'MTN MoMo', 'code' => 'M', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY],
        'wave' => ['label' => 'Wave', 'code' => 'W', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY],
        'moov' => ['label' => 'Moov Money', 'code' => 'V', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY],
        'bank' => ['label' => 'Banque / virement', 'code' => 'B', 'type' => TreasuryAccount::TYPE_BANK],
    ];

    /** Moyens proposés partout, même sans caisse (historique des formulaires). */
    private const ALWAYS = ['cash', 'om', 'momo', 'wave', 'moov'];

    /** @var array<string, array{label: string, type: string}>|null */
    private static ?array $custom = null;

    public static function flush(): void
    {
        self::$custom = null;
    }

    /** @return array<string, array{label: string, type: string}> moyens des caisses créées (hors standard) */
    private static function custom(): array
    {
        return self::$custom ??= TreasuryAccount::query()
            ->where('is_active', true)
            ->whereNotNull('method_key')
            ->whereNotIn('method_key', array_keys(self::STANDARD))
            ->orderBy('name')
            ->get(['method_key', 'name', 'type'])
            ->unique('method_key')
            ->mapWithKeys(fn ($a) => [$a->method_key => ['label' => $a->name, 'type' => $a->type]])
            ->all();
    }

    /** Clé d'un moyen standard à partir d'un libellé ou alias (orange → om…), sinon la clé telle quelle. */
    public static function keyFor(?string $method): string
    {
        $key = str_replace([' ', '-', '.'], '_', strtolower(trim((string) $method)));

        return match (true) {
            $key === '' || in_array($key, ['cash', 'especes', 'espece', 'espèces'], true) => 'cash',
            in_array($key, ['om', 'orange', 'orange_money', 'orange_mobile'], true) => 'om',
            in_array($key, ['momo', 'mtn', 'mtn_momo', 'mobile_money', 'mobilemoney'], true) => 'momo',
            $key === 'wave' => 'wave',
            in_array($key, ['moov', 'moov_money', 'moovmoney'], true) => 'moov',
            in_array($key, ['bank', 'bank_transfer', 'virement', 'transfer', 'cheque', 'cheque_bancaire', 'card', 'carte'], true) => 'bank',
            default => $key,
        };
    }

    public static function isCustom(?string $method): bool
    {
        return array_key_exists((string) $method, self::custom());
    }

    /** Type de caisse d'un moyen (cash, mobile_money, bank), null si inconnu. */
    public static function typeOf(?string $method): ?string
    {
        $key = self::keyFor($method);

        return self::STANDARD[$key]['type'] ?? self::custom()[$key]['type'] ?? null;
    }

    public static function label(?string $method): string
    {
        $key = self::keyFor($method);

        return self::STANDARD[$key]['label'] ?? self::custom()[$key]['label'] ?? (string) $method;
    }

    /** @return array<int, string> valeurs acceptées pour `payment_type` / `payment_method` */
    public static function keys(): array
    {
        return array_values(array_unique(array_merge(array_keys(self::STANDARD), array_keys(self::custom()))));
    }

    /** Règle de validation : un moyen standard ou celui d'une caisse active. */
    public static function rule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            if ($value !== null && $value !== '' && ! in_array($value, self::keys(), true)) {
                $fail("Le moyen de paiement « {$value} » n'existe pas.");
            }
        };
    }

    /**
     * Moyens proposés dans les formulaires : une entrée par caisse active de
     * l'agence (ou de tout le réseau sans agence), plus les moyens standard
     * habituels. Espèces en premier.
     *
     * @return array<int, array{key: string, label: string, code: ?string, type: string, requires_phone: bool, has_account: bool}>
     */
    public static function forAgency(?string $agencyId): array
    {
        $accounts = TreasuryAccount::query()
            ->where('is_active', true)
            ->whereNotNull('method_key')
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->orderBy('code')
            ->get(['method_key', 'name', 'code', 'type'])
            ->unique('method_key')
            ->keyBy('method_key');

        $keys = collect(self::ALWAYS)
            // La banque n'est proposée que si l'agence a un compte bancaire.
            ->merge($accounts->keys())
            ->unique()
            ->values();

        return $keys->map(function (string $key) use ($accounts) {
            $account = $accounts->get($key);
            $type = $account?->type ?? self::STANDARD[$key]['type'] ?? TreasuryAccount::TYPE_CASH;

            return [
                'key' => $key,
                // Espèces garde son libellé court ; les autres prennent le nom de la caisse.
                'label' => $key === 'cash' ? self::STANDARD['cash']['label'] : ($account?->name ?? self::STANDARD[$key]['label'] ?? $key),
                'code' => $account?->code ?? self::STANDARD[$key]['code'] ?? null,
                'type' => $type,
                'requires_phone' => $type === TreasuryAccount::TYPE_MOBILE_MONEY,
                'has_account' => $account !== null,
            ];
        })->sortBy(fn ($m) => $m['key'] === 'cash' ? '0' : '1'.$m['label'])->values()->all();
    }

    /** Clé d'une nouvelle caisse à partir de son nom (« Airtel Money » → airtel_money). */
    public static function keyFromName(string $name): string
    {
        $slug = Str::slug($name, '_');
        $key = self::keyFor($slug);

        return Str::limit($key !== '' ? $key : 'caisse', 40, '');
    }
}
