<?php

namespace Tests\Feature;

use App\Models\AdCampaign;
use App\Models\Agency;
use App\Models\Country;
use App\Services\AdCampaignService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Publicité Pekegno (cahier §2) : la part d'une campagne dans une période
 * suit ses jours ; une campagne terminée reste dans l'historique ; une
 * campagne locale pèse à 100 % sur l'agence de sa ville.
 */
class AdCampaignRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_campaign_cost_is_spread_over_its_months_and_kept_when_completed(): void
    {
        $country = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF']);
        $douala = Agency::factory()->create(['country_id' => $country->id]);
        $yaounde = Agency::factory()->create(['country_id' => $country->id]);

        // Locale, Douala, 1er octobre → 30 novembre (61 jours), terminée.
        AdCampaign::create([
            'name' => 'Facebook Douala', 'country_id' => $country->id, 'agency_id' => $douala->id,
            'branch' => 'academy', 'is_national' => false, 'budget' => 61000,
            'start_date' => '2026-10-01', 'end_date' => '2026-11-30', 'status' => AdCampaign::STATUS_COMPLETED,
        ]);

        $service = app(AdCampaignService::class);
        // Bornes comme l'application : jours métier (Douala) convertis en UTC.
        $tz = \App\Support\Period::businessTimezone();
        $day = fn (string $d, bool $end = false) => ($end ? Carbon::parse($d, $tz)->endOfDay() : Carbon::parse($d, $tz)->startOfDay())->utc();
        $oct = $service->getAgencyAdCosts($douala, $day('2026-10-01'), $day('2026-10-31', true));
        $nov = $service->getAgencyAdCosts($douala, $day('2026-11-01'), $day('2026-11-30', true));

        // 31 jours en octobre, 30 en novembre : 31 000 + 30 000 = le budget, pas 2 × 61 000.
        $this->assertEquals(31000, $oct['local_ads']);
        $this->assertEquals(30000, $nov['local_ads']);
        // Yaoundé ne porte rien d'une campagne de Douala.
        $this->assertEquals(0, $service->getAgencyAdCosts($yaounde, $day('2026-10-01'), $day('2026-11-30', true))['total_ads']);
        // Filtre de branche (rapport du département Agency) : campagne Academy exclue.
        $this->assertEquals(0, $service->getAgencyAdCosts($douala, $day('2026-10-01'), $day('2026-10-31', true), 'agency')['total_ads']);
    }
}
