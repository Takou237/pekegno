<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AgencyCategory;
use App\Models\ClientTeamRole;
use App\Models\Country;
use App\Models\Department;
use App\Models\Role;
use App\Models\SubscriptionPack;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Duplication multi-pays d'un package (catalogue « Agency », comme les services/formations). */
class PackageMultiCountryTest extends TestCase
{
    use RefreshDatabase;

    private Country $cm;

    private Country $ci;

    private Agency $douala;

    private Agency $yaounde;

    private Agency $abidjan;

    private Department $doualaDept;

    private Department $yaoundeDept;

    private Department $abidjanDept;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));

        $this->cm = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF']);
        $this->ci = Country::create(['name' => "Côte d'Ivoire", 'code' => 'CIV', 'currency_code' => 'XOF']);
        $this->douala = Agency::factory()->create(['country_id' => $this->cm->id]);
        $this->yaounde = Agency::factory()->create(['country_id' => $this->cm->id]);
        $this->abidjan = Agency::factory()->create(['country_id' => $this->ci->id]);
        $this->doualaDept = Department::factory()->create(['agency_id' => $this->douala->id, 'type' => Department::TYPE_AGENCY]);
        $this->yaoundeDept = Department::factory()->create(['agency_id' => $this->yaounde->id, 'type' => Department::TYPE_AGENCY]);
        $this->abidjanDept = Department::factory()->create(['agency_id' => $this->abidjan->id, 'type' => Department::TYPE_AGENCY]);
    }

    public function test_package_is_created_in_every_agency_of_selected_countries(): void
    {
        $category = AgencyCategory::create([
            'department_id' => $this->doualaDept->id,
            'kind' => AgencyCategory::KIND_PACKAGE,
            'name' => 'Marketing',
        ]);
        $role = ClientTeamRole::create(['department_id' => $this->doualaDept->id, 'name' => 'Community manager']);

        $this->postJson('/api/packages', [
            'agency_id' => $this->douala->id,
            'department_id' => $this->doualaDept->id,
            'category_id' => $category->id,
            'name' => 'Pack Digital',
            'tagline' => 'Votre présence en ligne',
            'price_per_month' => 100000,
            'billing_period' => 'monthly',
            'items' => [
                ['label' => 'Posts Facebook', 'quantity' => 4, 'frequency' => 'per_month', 'action_type' => 'community_management'],
            ],
            'recommendations' => [
                ['label' => 'Community manager', 'quantity' => 1, 'client_team_role_id' => $role->id],
            ],
            'target_country_ids' => [$this->cm->id, $this->ci->id],
        ])->assertCreated();

        $packages = SubscriptionPack::where('name', 'Pack Digital')->get();
        $this->assertEqualsCanonicalizing(
            [$this->douala->id, $this->yaounde->id, $this->abidjan->id],
            $packages->pluck('agency_id')->all()
        );
        $this->assertCount(3, $packages->pluck('code')->unique());

        foreach ($packages as $package) {
            $this->assertCount(1, $package->items);
            $this->assertCount(1, $package->recommendations);
            $this->assertSame(100000.0, (float) $package->price_per_month);
        }

        // Chaque copie vit dans le département de SON agence.
        $this->assertSame($this->doualaDept->id, $packages->firstWhere('agency_id', $this->douala->id)->department_id);
        $this->assertSame($this->yaoundeDept->id, $packages->firstWhere('agency_id', $this->yaounde->id)->department_id);
        $this->assertSame($this->abidjanDept->id, $packages->firstWhere('agency_id', $this->abidjan->id)->department_id);

        // Catégorie : réutilisée chez l'agence d'origine, recréée par nom ailleurs.
        $this->assertSame($category->id, $packages->firstWhere('agency_id', $this->douala->id)->category_id);
        $yaoundeCategory = AgencyCategory::where('department_id', $this->yaoundeDept->id)->where('name', 'Marketing')->first();
        $abidjanCategory = AgencyCategory::where('department_id', $this->abidjanDept->id)->where('name', 'Marketing')->first();
        $this->assertNotNull($yaoundeCategory);
        $this->assertNotNull($abidjanCategory);
        $this->assertSame($yaoundeCategory->id, $packages->firstWhere('agency_id', $this->yaounde->id)->category_id);
        $this->assertSame($abidjanCategory->id, $packages->firstWhere('agency_id', $this->abidjan->id)->category_id);

        // Rôle d'équipe client : même logique.
        $yaoundeRole = ClientTeamRole::where('department_id', $this->yaoundeDept->id)->where('name', 'Community manager')->first();
        $this->assertNotNull($yaoundeRole);
        $this->assertSame(
            $yaoundeRole->id,
            $packages->firstWhere('agency_id', $this->yaounde->id)->recommendations->first()->client_team_role_id
        );
    }

    public function test_without_target_countries_only_the_chosen_agency_gets_it(): void
    {
        $this->postJson('/api/packages', [
            'agency_id' => $this->douala->id,
            'name' => 'Solo',
            'price_per_month' => 50000,
        ])->assertCreated();

        $this->assertSame(1, SubscriptionPack::where('name', 'Solo')->count());
    }

    public function test_package_can_be_created_from_countries_only_without_agency(): void
    {
        $this->postJson('/api/packages', [
            'name' => 'Pays uniquement',
            'price_per_month' => 75000,
            'target_country_ids' => [$this->cm->id],
        ])->assertCreated();

        $packages = SubscriptionPack::where('name', 'Pays uniquement')->get();
        $this->assertEqualsCanonicalizing([$this->douala->id, $this->yaounde->id], $packages->pluck('agency_id')->all());
    }

    public function test_agency_or_target_countries_is_required(): void
    {
        $response = $this->postJson('/api/packages', [
            'name' => 'Sans cible',
            'price_per_month' => 1000,
        ])->assertStatus(422);

        $this->assertArrayHasKey('target_country_ids', $response->json('errors'));
    }

    public function test_index_can_be_filtered_by_country(): void
    {
        $this->postJson('/api/packages', [
            'agency_id' => $this->douala->id,
            'name' => 'Pack Cameroun',
            'price_per_month' => 10000,
        ])->assertCreated();
        $this->postJson('/api/packages', [
            'agency_id' => $this->abidjan->id,
            'name' => 'Pack CI',
            'price_per_month' => 10000,
        ])->assertCreated();

        $ci = $this->getJson('/api/packages?country_id='.$this->ci->id)->assertOk()->json('data');
        $this->assertSame([$this->abidjan->id], collect($ci)->pluck('agency_id')->all());

        $cm = $this->getJson('/api/packages?country_id='.$this->cm->id)->assertOk()->json('data');
        $this->assertSame([$this->douala->id], collect($cm)->pluck('agency_id')->all());
    }
}
