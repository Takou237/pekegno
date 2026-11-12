<?php

namespace Tests\Feature;

use App\Models\AdCampaign;
use App\Models\Agency;
use App\Models\Country;
use App\Models\Department;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Service;
use App\Services\AdCampaignService;
use App\Support\Period;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * T3.8 à T3.11 — Publicité Pekegno (campagnes locales et nationales).
 */
class AdCampaignAllocationTest extends TestCase
{
    use RefreshDatabase;

    public function test_local_ad_campaign_is_allocated_strictly_to_targeted_agency(): void
    {
        $country = Country::create([
            'name' => 'Cameroun',
            'code' => 'CM',
            'currency_code' => 'XAF',
            'exchange_rate' => 1.0,
            'phone_code' => '237',
        ]);

        $agencyDouala = Agency::create([
            'name' => 'Douala',
            'code' => 'DLA',
            'country_id' => $country->id,
            'country' => 'Cameroun',
            'city' => 'Douala',
        ]);

        $agencyYaounde = Agency::create([
            'name' => 'Yaoundé',
            'code' => 'YDE',
            'country_id' => $country->id,
            'country' => 'Cameroun',
            'city' => 'Yaoundé',
        ]);

        // Campagne locale Douala
        $campaign = AdCampaign::create([
            'name' => 'Campagne Facebook Douala',
            'branch' => Department::TYPE_ACADEMY,
            'country_id' => $country->id,
            'is_national' => false,
            'agency_id' => $agencyDouala->id,
            'budget' => 150000,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => AdCampaign::STATUS_ACTIVE,
        ]);

        $service = app(AdCampaignService::class);
        $from = Carbon::parse('2026-11-01');
        $to = Carbon::parse('2026-11-30');

        $costsDouala = $service->getAgencyAdCosts($agencyDouala, $from, $to);
        $costsYaounde = $service->getAgencyAdCosts($agencyYaounde, $from, $to);

        $this->assertEquals(150000, $costsDouala['local_ads']);
        $this->assertEquals(0, $costsDouala['national_ads']);
        $this->assertEquals(150000, $costsDouala['total_ads']);

        $this->assertEquals(0, $costsYaounde['total_ads']);
    }

    public function test_national_ad_campaign_is_allocated_pro_rata_to_branch_revenue(): void
    {
        $country = Country::create([
            'name' => 'Cameroun',
            'code' => 'CM',
            'currency_code' => 'XAF',
            'exchange_rate' => 1.0,
            'phone_code' => '237',
        ]);

        $agencyDouala = Agency::create([
            'name' => 'Douala',
            'code' => 'DLA',
            'country_id' => $country->id,
            'country' => 'Cameroun',
            'city' => 'Douala',
        ]);

        $agencyYaounde = Agency::create([
            'name' => 'Yaoundé',
            'code' => 'YDE',
            'country_id' => $country->id,
            'country' => 'Cameroun',
            'city' => 'Yaoundé',
        ]);

        // Créer un service du catalogue (branche store par défaut)
        $service = Service::factory()->create([
            'name' => 'Livre Pekegno',
            'price' => 10000,
        ]);

        // Facture 1 à Douala : 300 000 FCFA
        $invoiceDouala = Invoice::create([
            'number' => 'FAC-DLA-01',
            'agency_id' => $agencyDouala->id,
            'invoice_date' => '2026-11-05',
            'due_date' => '2026-11-05',
            'total_amount' => 300000,
            'amount_paid' => 300000,
            'payment_status' => 'paid',
            'validation_status' => 'validated',
        ]);
        InvoiceItem::create([
            'invoice_id' => $invoiceDouala->id,
            'service_id' => $service->id,
            'label' => 'Livre Pekegno',
            'quantity' => 30,
            'unit_price' => 10000,
            'line_total' => 300000,
            'total_price' => 300000,
        ]);

        // Facture 2 à Yaoundé : 100 000 FCFA
        // Total national = 400 000 FCFA -> Douala = 75 %, Yaoundé = 25 %
        $invoiceYaounde = Invoice::create([
            'number' => 'FAC-YDE-01',
            'agency_id' => $agencyYaounde->id,
            'invoice_date' => '2026-11-10',
            'due_date' => '2026-11-10',
            'total_amount' => 100000,
            'amount_paid' => 100000,
            'payment_status' => 'paid',
            'validation_status' => 'validated',
        ]);
        InvoiceItem::create([
            'invoice_id' => $invoiceYaounde->id,
            'service_id' => $service->id,
            'label' => 'Livre Pekegno',
            'quantity' => 10,
            'unit_price' => 10000,
            'line_total' => 100000,
            'total_price' => 100000,
        ]);

        // Campagne nationale Pekegno de 200 000 FCFA sur la branche Store
        $campaign = AdCampaign::create([
            'name' => 'Campagne Nationale Pekegno Store',
            'branch' => Department::TYPE_STORE,
            'country_id' => $country->id,
            'is_national' => true,
            'budget' => 200000,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => AdCampaign::STATUS_ACTIVE,
        ]);

        $serviceApp = app(AdCampaignService::class);
        $from = Carbon::parse('2026-11-01');
        $to = Carbon::parse('2026-11-30');

        $costsDouala = $serviceApp->getAgencyAdCosts($agencyDouala, $from, $to);
        $costsYaounde = $serviceApp->getAgencyAdCosts($agencyYaounde, $from, $to);

        // Douala doit supporter 75% de 200 000 = 150 000
        $this->assertEquals(0, $costsDouala['local_ads']);
        $this->assertEquals(150000, $costsDouala['national_ads']);
        $this->assertEquals(150000, $costsDouala['total_ads']);

        // Yaoundé doit supporter 25% de 200 000 = 50 000
        $this->assertEquals(0, $costsYaounde['local_ads']);
        $this->assertEquals(50000, $costsYaounde['national_ads']);
        $this->assertEquals(50000, $costsYaounde['total_ads']);

        // Total réparti = budget de la campagne nationale
        $this->assertEquals(200000, $costsDouala['national_ads'] + $costsYaounde['national_ads']);
    }
}
