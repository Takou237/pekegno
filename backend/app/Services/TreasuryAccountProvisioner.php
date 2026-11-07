<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\TreasuryAccount;
use Illuminate\Support\Facades\Log;

/**
 * Caisses codifiées d'une agence (cahier WORLDEV, section 2 ; plan T2.1/T2.2/T2.5).
 *
 * C = espèces, O = Orange Money, M = MTN MoMo, B = banque, W = Wave, V = Moov Money.
 * Les caisses O/M/B/W/V ne sont visibles que de l'administration et de la DG
 * (Sécu §16) ; la caisse C est visible de tout le périmètre de l'agence.
 *
 * Source unique des modèles de caisses : utilisée par le seeder, la résolution
 * de caisse d'un paiement et la commande de rattrapage des paiements.
 */
class TreasuryAccountProvisioner
{
    public const RESTRICTED_ROLES = ['super-admin', 'direction-generale', 'comptable'];

    /** @var array<string, array{name: string, type: string, provider: ?string}> */
    public const TEMPLATES = [
        'C' => ['name' => 'Caisse Principale', 'type' => TreasuryAccount::TYPE_CASH, 'provider' => null],
        'O' => ['name' => 'Orange Money', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY, 'provider' => 'orange_money'],
        'M' => ['name' => 'MTN MoMo', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY, 'provider' => 'mtn_momo'],
        'B' => ['name' => 'Compte bancaire', 'type' => TreasuryAccount::TYPE_BANK, 'provider' => null],
        'W' => ['name' => 'Wave', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY, 'provider' => 'wave'],
        'V' => ['name' => 'Moov Money', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY, 'provider' => 'moov_money'],
    ];

    /**
     * Code de caisse attendu pour un mode de paiement, ou null si le mode est
     * ambigu (« mobile » générique : plusieurs caisses numériques possibles).
     */
    public static function codeForMethod(?string $method): ?string
    {
        $key = str_replace([' ', '-', '.'], '_', strtolower(trim((string) $method)));

        return match (true) {
            $key === '' || in_array($key, ['cash', 'especes', 'espece', 'espèces'], true) => 'C',
            in_array($key, ['om', 'orange', 'orange_money', 'orange_mobile'], true) => 'O',
            in_array($key, ['momo', 'mtn', 'mtn_momo'], true) => 'M',
            $key === 'wave' => 'W',
            in_array($key, ['moov', 'moov_money', 'moovmoney'], true) => 'V',
            RevenueService::normalizeMode($key) === RevenueService::MODE_BANK => 'B',
            RevenueService::normalizeMode($key) === RevenueService::MODE_CASH => 'C',
            default => null,
        };
    }

    /** Codes standard d'une agence selon la devise de son pays. */
    public function codesForAgency(?Agency $agency): array
    {
        return $this->currencyFor($agency) === 'XOF'
            ? ['C', 'O', 'M', 'B', 'W', 'V']
            : ['C', 'O', 'M', 'B'];
    }

    /** Crée (ou complète) les caisses standard d'une agence. Idempotent. */
    public function ensureForAgency(Agency $agency): void
    {
        foreach ($this->codesForAgency($agency) as $code) {
            $this->ensureAccount($agency, $code);
        }
    }

    /**
     * Retourne la caisse `$code` de l'agence (null = caisses hors agence), en la
     * créant si elle n'existe pas encore. Une caisse existante n'est jamais
     * modifiée : son nom, son solde initial ou sa visibilité restent ceux saisis.
     */
    public function ensureAccount(?Agency $agency, string $code): TreasuryAccount
    {
        $template = self::TEMPLATES[$code] ?? null;
        abort_if($template === null, 422, "Code de caisse inconnu : {$code}.");

        $existing = TreasuryAccount::withTrashed()
            ->where('agency_id', $agency?->id)
            ->where('code', $code)
            ->first();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }

            return $existing;
        }

        $account = TreasuryAccount::create([
            'agency_id' => $agency?->id,
            'code' => $code,
            'name' => $template['name'],
            'type' => $template['type'],
            'provider' => $template['provider'],
            'opening_balance' => 0,
            'currency_code' => $this->currencyFor($agency),
            'is_active' => true,
            'visible_roles' => $template['type'] === TreasuryAccount::TYPE_CASH ? null : self::RESTRICTED_ROLES,
        ]);

        Log::info('Caisse créée automatiquement', [
            'agency_id' => $agency?->id,
            'code' => $code,
            'account_id' => $account->id,
        ]);

        return $account;
    }

    private function currencyFor(?Agency $agency): string
    {
        return $agency?->geoCountry?->currency_code ?? 'XAF';
    }
}
