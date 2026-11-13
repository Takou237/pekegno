<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\TreasuryAccount;
use Illuminate\Support\Facades\Log;

/**
 * Caisses codifiées d'une agence (cahier WORLDEV, section 2 ; plan T2.1/T2.2/T2.5).
 *
 * C = espèces, O = Orange Money, M = MTN MoMo, B = banque, W = Wave, V = Moov Money.
 *
 * Caisses standard par pays (décision client T0.3) : Cameroun (XAF) = C/O/M/B ;
 * Côte d'Ivoire (XOF) = C/O/M/B/W. Moov (V) n'est pas déployé : la caisse n'est
 * créée qu'à la demande, si un paiement Moov est réellement enregistré.
 * Les caisses O/M/B/W/V ne sont visibles que de l'administration et de la DG
 * (Sécu §16) ; la caisse C est visible de tout le périmètre de l'agence.
 *
 * Source unique des modèles de caisses : utilisée par le seeder, la résolution
 * de caisse d'un paiement et la commande de rattrapage des paiements.
 */
class TreasuryAccountProvisioner
{
    /**
     * « Administration » (décision client du 13/11) : super-admin, direction
     * générale, chef d'agence, chef de département — et le comptable. Eux seuls
     * voient les caisses O/M/B/W/V ; la caissière ne voit que la caisse espèces.
     */
    public const RESTRICTED_ROLES = ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement', 'comptable'];

    /** @var array<string, array{name: string, type: string, provider: ?string}> */
    public const TEMPLATES = [
        'C' => ['name' => 'Caisse Espèces', 'type' => TreasuryAccount::TYPE_CASH, 'provider' => null],
        'O' => ['name' => 'Orange Money', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY, 'provider' => 'orange_money'],
        'M' => ['name' => 'MTN MoMo', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY, 'provider' => 'mtn_momo'],
        'B' => ['name' => 'Compte bancaire', 'type' => TreasuryAccount::TYPE_BANK, 'provider' => null],
        'W' => ['name' => 'Wave', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY, 'provider' => 'wave'],
        'V' => ['name' => 'Moov Money', 'type' => TreasuryAccount::TYPE_MOBILE_MONEY, 'provider' => 'moov_money'],
    ];

    /** Moyen de paiement de chaque caisse standard (une caisse = un moyen). */
    public const METHOD_KEYS = ['C' => 'cash', 'O' => 'om', 'M' => 'momo', 'B' => 'bank', 'W' => 'wave', 'V' => 'moov'];

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
            ? ['C', 'O', 'M', 'B', 'W']
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
            ->when($agency === null, fn ($q) => $q->whereNull('country_id'))
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
            'method_key' => self::METHOD_KEYS[$code] ?? null,
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

    /**
     * Caisses de l'Administration d'un pays (cahier §2) : espèces, Orange
     * Money, MTN MoMo, banque (+ Wave en zone XOF). Elles reçoivent l'argent
     * des agences et paient les dépenses du groupe. Visibles de
     * l'administration seulement. Idempotent.
     */
    public function ensureForAdministration(\App\Models\Country $country): void
    {
        $codes = ($country->currency_code ?? 'XAF') === 'XOF' ? ['C', 'O', 'M', 'B', 'W'] : ['C', 'O', 'M', 'B'];

        foreach ($codes as $code) {
            $template = self::TEMPLATES[$code];
            $exists = TreasuryAccount::withTrashed()->whereNull('agency_id')->where('country_id', $country->id)->where('code', $code)->first();
            if ($exists) {
                $exists->trashed() && $exists->restore();

                continue;
            }

            TreasuryAccount::create([
                'agency_id' => null,
                'country_id' => $country->id,
                'code' => $code,
                'method_key' => self::METHOD_KEYS[$code] ?? null,
                'name' => ($code === 'C' ? 'Caisse Administration' : $template['name'].' — Administration'),
                'type' => $template['type'],
                'provider' => $template['provider'],
                'opening_balance' => 0,
                'currency_code' => $country->currency_code ?? 'XAF',
                'is_active' => true,
                'visible_roles' => self::RESTRICTED_ROLES,
            ]);
        }
    }

    private function currencyFor(?Agency $agency): string
    {
        return $agency?->geoCountry?->currency_code ?? 'XAF';
    }
}
