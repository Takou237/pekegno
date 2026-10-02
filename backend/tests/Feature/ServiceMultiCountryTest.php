<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Country;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServiceMultiCountryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
    }

    public function test_service_is_created_in_every_agency_of_selected_countries(): void
    {
        $cm = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF']);
        $ci = Country::create(['name' => "Côte d'Ivoire", 'code' => 'CIV', 'currency_code' => 'XOF']);
        $douala = Agency::factory()->create(['country_id' => $cm->id]);
        $yaounde = Agency::factory()->create(['country_id' => $cm->id]);
        $abidjan = Agency::factory()->create(['country_id' => $ci->id]);
        $category = Category::factory()->create();

        $response = $this->postJson('/api/services', [
            'name' => 'Pack Excel',
            'category_id' => $category->id,
            'agency_id' => $douala->id,
            'price' => 25000,
            'bonus_fixed' => 1500,
            'is_seminar' => true,
            'tiers' => [['tier' => 'classique', 'label' => 'Classique', 'price' => 25000]],
            'target_country_ids' => [$cm->id, $ci->id],
        ])->assertCreated();

        // La réponse est la copie de l'agence choisie.
        $this->assertSame($douala->id, $response->json('data.agency_id') ?? $response->json('agency_id'));

        $services = Service::with('seminarTiers')->where('name', 'Pack Excel')->get();
        $this->assertEqualsCanonicalizing([$douala->id, $yaounde->id, $abidjan->id], $services->pluck('agency_id')->all());
        $this->assertCount(3, $services->pluck('code')->unique());
        foreach ($services as $service) {
            $this->assertSame('1500.00', (string) $service->bonus_fixed);
            $this->assertCount(1, $service->seminarTiers);
        }
    }

    public function test_without_target_countries_only_the_chosen_agency_gets_it(): void
    {
        $agency = Agency::factory()->create();
        Agency::factory()->create();

        $this->postJson('/api/services', [
            'name' => 'Solo',
            'category_id' => Category::factory()->create()->id,
            'agency_id' => $agency->id,
            'price' => 1000,
        ])->assertCreated();

        $this->assertSame(1, Service::where('name', 'Solo')->count());
    }

    public function test_service_can_be_created_from_countries_only_without_agency(): void
    {
        $cm = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF']);
        $douala = Agency::factory()->create(['country_id' => $cm->id]);
        $yaounde = Agency::factory()->create(['country_id' => $cm->id]);
        Agency::factory()->create();

        $this->postJson('/api/services', [
            'name' => 'Sans agence',
            'category_id' => Category::factory()->create()->id,
            'price' => 5000,
            'target_country_ids' => [$cm->id],
        ])->assertCreated();

        $this->assertEqualsCanonicalizing(
            [$douala->id, $yaounde->id],
            Service::where('name', 'Sans agence')->pluck('agency_id')->all(),
        );
    }

    public function test_neither_agency_nor_country_is_rejected(): void
    {
        $this->postJson('/api/services', [
            'name' => 'Nulle part',
            'category_id' => Category::factory()->create()->id,
            'price' => 5000,
        ])->assertStatus(422)->assertJsonValidationErrors(['target_country_ids']);

        $empty = Country::create(['name' => 'Vide', 'code' => 'VID', 'currency_code' => 'XAF']);
        $this->postJson('/api/services', [
            'name' => 'Nulle part',
            'category_id' => Category::factory()->create()->id,
            'price' => 5000,
            'target_country_ids' => [$empty->id],
        ])->assertStatus(422)->assertJsonValidationErrors(['target_country_ids']);

        $this->assertSame(0, Service::where('name', 'Nulle part')->count());
    }

    public function test_bonus_fixed_is_saved_on_update(): void
    {
        $service = Service::factory()->create();

        $this->putJson("/api/services/{$service->id}", ['bonus_fixed' => 2000])->assertOk();

        $this->assertSame('2000.00', (string) $service->fresh()->bonus_fixed);
    }
}
