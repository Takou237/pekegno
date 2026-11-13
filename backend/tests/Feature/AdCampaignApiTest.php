<?php

namespace Tests\Feature;

use App\Models\AdCampaign;
use App\Models\Agency;
use App\Models\Country;
use App\Models\Department;
use App\Models\Expense;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** T3.8 — Publicité Pekegno : campagnes locales et nationales. */
class AdCampaignApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    public function test_an_administrator_creates_a_local_and_a_national_campaign(): void
    {
        $country = $this->country('CMR');
        $agency = Agency::factory()->create(['country_id' => $country->id]);

        Sanctum::actingAs($this->user('super-admin'));

        $local = $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Facebook Douala',
            'is_national' => false,
            'agency_id' => $agency->id,
        ]))->assertCreated()->json();

        $this->assertSame($agency->id, $local['agency_id']);
        $this->assertSame($country->id, $local['country_id']);

        $national = $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Campagne nationale',
            'is_national' => true,
            'country_id' => $country->id,
        ]))->assertCreated()->json();

        $this->assertNull($national['agency_id']);
        $this->assertSame($country->id, $national['country_id']);

        $this->getJson('/api/ad-campaigns?per_page=50')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_an_agency_chief_manages_only_their_local_campaigns(): void
    {
        $country = $this->country('CMR');
        $ownAgency = Agency::factory()->create(['country_id' => $country->id]);
        $otherAgency = Agency::factory()->create(['country_id' => $country->id]);

        $chief = $this->user('responsable-agence');
        $chief->assignments()->sync([$ownAgency->id => ['is_primary' => true]]);
        Sanctum::actingAs($chief);

        $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Pub agence',
            'is_national' => false,
            'agency_id' => $ownAgency->id,
        ]))->assertCreated();

        $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Pub autre agence',
            'is_national' => false,
            'agency_id' => $otherAgency->id,
        ]))->assertForbidden();

        $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Pub nationale',
            'is_national' => true,
            'country_id' => $country->id,
        ]))->assertUnprocessable();

        $admin = $this->user('super-admin');
        $this->campaign($admin, $country, $otherAgency, 'Pub autre agence');
        $national = $this->campaign($admin, $country, null, 'Nationale', true);

        $names = collect($this->getJson('/api/ad-campaigns?per_page=50')->assertOk()->json('data'))
            ->pluck('name');

        $this->assertTrue($names->contains('Pub agence'));
        $this->assertTrue($names->contains($national->name));
        $this->assertFalse($names->contains('Pub autre agence'));
    }

    public function test_a_country_director_is_limited_to_their_country(): void
    {
        $cameroun = $this->country('CMR');
        $gabon = $this->country('GAB');
        $agency = Agency::factory()->create(['country_id' => $cameroun->id]);
        $otherAgency = Agency::factory()->create(['country_id' => $gabon->id]);

        $admin = $this->user('super-admin');
        $own = $this->campaign($admin, $cameroun, null, 'Nationale Cameroun', true);
        $other = $this->campaign($admin, $gabon, null, 'Nationale Gabon', true);

        Sanctum::actingAs($this->user('direction-generale', $cameroun));

        $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Nationale Cameroun 2',
            'is_national' => true,
            'country_id' => $cameroun->id,
        ]))->assertCreated();

        $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Nationale Gabon 2',
            'is_national' => true,
            'country_id' => $gabon->id,
        ]))->assertForbidden();

        $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Locale Cameroun',
            'is_national' => false,
            'agency_id' => $agency->id,
        ]))->assertCreated();

        $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Locale Gabon',
            'is_national' => false,
            'agency_id' => $otherAgency->id,
        ]))->assertForbidden();

        $ids = collect($this->getJson('/api/ad-campaigns?per_page=50')->assertOk()->json('data'))
            ->pluck('id');

        $this->assertTrue($ids->contains($own->id));
        $this->assertFalse($ids->contains($other->id));
    }

    public function test_a_campaign_automatically_creates_its_draft_expense(): void
    {
        $country = $this->country('CMR');
        $agency = Agency::factory()->create(['country_id' => $country->id]);

        Sanctum::actingAs($this->user('super-admin'));

        $local = $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Facebook Douala',
            'is_national' => false,
            'agency_id' => $agency->id,
            'budget' => 150000,
        ]))->assertCreated()->json();

        $campaign = AdCampaign::findOrFail($local['id']);
        $this->assertNotNull($campaign->expense_id, 'La campagne doit engager sa dépense.');

        $expense = Expense::findOrFail($campaign->expense_id);
        $this->assertSame($campaign->id, $expense->ad_campaign_id);
        $this->assertSame($agency->id, $expense->agency_id);
        $this->assertNull($expense->country_id);
        $this->assertEquals(150000, (float) $expense->amount);
        $this->assertSame(Expense::STATUS_DRAFT, $expense->status);
        $this->assertSame('2026-11-01', $expense->expense_date->toDateString());
        $this->assertSame('Publicité Pekegno', $expense->category?->name);

        // Campagne nationale : la dépense est portée par l'Administration du pays.
        $national = $this->postJson('/api/ad-campaigns', $this->payload([
            'name' => 'Campagne nationale',
            'is_national' => true,
            'country_id' => $country->id,
            'budget' => 90000,
        ]))->assertCreated()->json();

        $nationalExpense = Expense::findOrFail(AdCampaign::findOrFail($national['id'])->expense_id);
        $this->assertNull($nationalExpense->agency_id);
        $this->assertSame($country->id, $nationalExpense->country_id);
        $this->assertEquals(90000, (float) $nationalExpense->amount);
    }

    public function test_a_campaign_without_budget_creates_no_expense(): void
    {
        $country = $this->country('CMR');
        $agency = Agency::factory()->create(['country_id' => $country->id]);

        Sanctum::actingAs($this->user('super-admin'));

        $campaign = $this->postJson('/api/ad-campaigns', $this->payload([
            'is_national' => false,
            'agency_id' => $agency->id,
            'budget' => 0,
        ]))->assertCreated()->json();

        $this->assertNull(AdCampaign::findOrFail($campaign['id'])->expense_id);
    }

    public function test_a_campaign_is_validated_and_scoped_for_updates_and_deletes(): void
    {
        $country = $this->country('CMR');
        $ownAgency = Agency::factory()->create(['country_id' => $country->id]);
        $otherAgency = Agency::factory()->create(['country_id' => $country->id]);

        Sanctum::actingAs($this->user('super-admin'));

        $this->postJson('/api/ad-campaigns', $this->payload([
            'is_national' => false,
            'agency_id' => null,
        ]))->assertUnprocessable();

        $this->postJson('/api/ad-campaigns', $this->payload([
            'is_national' => true,
            'country_id' => null,
        ]))->assertUnprocessable();

        $this->postJson('/api/ad-campaigns', $this->payload([
            'start_date' => '2026-11-30',
            'end_date' => '2026-11-01',
        ]))->assertUnprocessable();

        $chief = $this->user('responsable-agence');
        $chief->assignments()->sync([$ownAgency->id => ['is_primary' => true]]);
        Sanctum::actingAs($chief);

        $own = $this->campaign($chief, $country, $ownAgency, 'Pub agence');
        $other = $this->campaign($chief, $country, $otherAgency, 'Pub autre agence');

        $this->putJson("/api/ad-campaigns/{$own->id}", $this->payload([
            'name' => 'Pub agence modifiée',
            'is_national' => false,
            'agency_id' => $ownAgency->id,
        ]))->assertOk()->assertJsonPath('name', 'Pub agence modifiée');

        $this->putJson("/api/ad-campaigns/{$other->id}", $this->payload([
            'is_national' => false,
            'agency_id' => $otherAgency->id,
        ]))->assertForbidden();

        $this->deleteJson("/api/ad-campaigns/{$other->id}")->assertForbidden();
        $this->deleteJson("/api/ad-campaigns/{$own->id}")->assertNoContent();
        $this->assertSoftDeleted('ad_campaigns', ['id' => $own->id]);
    }

    public function test_updating_a_campaign_syncs_its_draft_expense(): void
    {
        $country = $this->country('CMR');
        $agency = Agency::factory()->create(['country_id' => $country->id]);

        Sanctum::actingAs($this->user('super-admin'));

        $campaign = AdCampaign::create([
            'name' => 'Pub locale',
            'branch' => Department::TYPE_STORE,
            'country_id' => $country->id,
            'is_national' => false,
            'agency_id' => $agency->id,
            'budget' => 100000,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => AdCampaign::STATUS_ACTIVE,
        ]);

        $this->putJson("/api/ad-campaigns/{$campaign->id}", $this->payload([
            'name' => 'Pub nationale',
            'is_national' => true,
            'country_id' => $country->id,
            'agency_id' => null,
            'budget' => 180000,
            'start_date' => '2026-11-05',
        ]))->assertOk();

        $expense = Expense::findOrFail($campaign->fresh()->expense_id);
        $this->assertEquals(180000, (float) $expense->amount);
        $this->assertSame('2026-11-05', $expense->expense_date->toDateString());
        $this->assertNull($expense->agency_id);
        $this->assertSame($country->id, $expense->country_id);

        // Budget ramené à zéro : la dépense non engagée disparaît.
        $this->putJson("/api/ad-campaigns/{$campaign->id}", $this->payload([
            'is_national' => true,
            'country_id' => $country->id,
            'budget' => 0,
        ]))->assertOk();

        $this->assertNull($campaign->fresh()->expense_id);
        $this->assertSoftDeleted('expenses', ['id' => $expense->id]);
    }

    public function test_an_engaged_expense_is_not_rewritten_by_the_campaign(): void
    {
        $country = $this->country('CMR');
        $agency = Agency::factory()->create(['country_id' => $country->id]);

        Sanctum::actingAs($this->user('super-admin'));

        $campaign = AdCampaign::create([
            'name' => 'Pub locale',
            'branch' => Department::TYPE_STORE,
            'country_id' => $country->id,
            'is_national' => false,
            'agency_id' => $agency->id,
            'budget' => 100000,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => AdCampaign::STATUS_ACTIVE,
        ]);

        $expense = Expense::create([
            'number' => Expense::generateNextNumber(),
            'agency_id' => $agency->id,
            'category_id' => \App\Models\AccountingCategory::where('name', 'Publicité Pekegno')->value('id'),
            'amount' => 100000,
            'expense_date' => '2026-11-01',
            'status' => Expense::STATUS_SUBMITTED,
            'requested_by' => $this->user('super-admin')->id,
            'ad_campaign_id' => $campaign->id,
        ]);
        $campaign->update(['expense_id' => $expense->id]);

        $this->putJson("/api/ad-campaigns/{$campaign->id}", $this->payload([
            'agency_id' => $agency->id,
            'budget' => 250000,
            'start_date' => '2026-11-10',
        ]))->assertOk();

        $this->assertEquals(100000, (float) $expense->fresh()->amount);
        $this->assertSame('2026-11-01', $expense->fresh()->expense_date->toDateString());
    }

    public function test_deleting_a_campaign_deletes_its_draft_expense(): void
    {
        $country = $this->country('CMR');
        $agency = Agency::factory()->create(['country_id' => $country->id]);

        Sanctum::actingAs($this->user('super-admin'));

        $campaign = AdCampaign::create([
            'name' => 'Pub locale',
            'branch' => Department::TYPE_STORE,
            'country_id' => $country->id,
            'is_national' => false,
            'agency_id' => $agency->id,
            'budget' => 100000,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => AdCampaign::STATUS_ACTIVE,
        ]);

        // Une dépense non engagée suit la campagne qu'on supprime.
        $draft = Expense::create([
            'number' => Expense::generateNextNumber(),
            'agency_id' => $agency->id,
            'category_id' => \App\Models\AccountingCategory::where('name', 'Publicité Pekegno')->value('id'),
            'amount' => 50000,
            'expense_date' => '2026-11-01',
            'status' => Expense::STATUS_DRAFT,
            'requested_by' => $this->user('super-admin')->id,
            'ad_campaign_id' => $campaign->id,
        ]);
        $campaign->update(['expense_id' => $draft->id]);

        $this->deleteJson("/api/ad-campaigns/{$campaign->id}")->assertNoContent();

        $this->assertSoftDeleted('expenses', ['id' => $draft->id]);
        $this->assertNull(AdCampaign::withTrashed()->findOrFail($campaign->id)->expense_id);
    }

    public function test_deleting_a_campaign_keeps_an_engaged_expense(): void
    {
        $country = $this->country('CMR');
        $agency = Agency::factory()->create(['country_id' => $country->id]);

        Sanctum::actingAs($this->user('super-admin'));

        $campaign = AdCampaign::create([
            'name' => 'Pub locale',
            'branch' => Department::TYPE_STORE,
            'country_id' => $country->id,
            'is_national' => false,
            'agency_id' => $agency->id,
            'budget' => 100000,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => AdCampaign::STATUS_ACTIVE,
        ]);

        $expense = Expense::create([
            'number' => Expense::generateNextNumber(),
            'agency_id' => $agency->id,
            'category_id' => \App\Models\AccountingCategory::where('name', 'Publicité Pekegno')->value('id'),
            'amount' => 100000,
            'expense_date' => '2026-11-01',
            'status' => Expense::STATUS_APPROVED,
            'requested_by' => $this->user('super-admin')->id,
            'ad_campaign_id' => $campaign->id,
        ]);
        $campaign->update(['expense_id' => $expense->id]);

        $this->deleteJson("/api/ad-campaigns/{$campaign->id}")->assertNoContent();

        // La dépense validée reste dans le circuit, détachée de la campagne.
        $this->assertNotSoftDeleted('expenses', ['id' => $expense->id]);
        $this->assertNull($expense->fresh()->ad_campaign_id);
        $this->assertSame(Expense::STATUS_APPROVED, $expense->fresh()->status);
    }

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'name' => 'Campagne test',
            'branch' => Department::TYPE_STORE,
            'is_national' => false,
            'budget' => 100000,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => AdCampaign::STATUS_ACTIVE,
        ];
    }

    private function campaign(User $user, Country $country, ?Agency $agency, string $name, bool $national = false): AdCampaign
    {
        return AdCampaign::create([
            'name' => $name,
            'branch' => Department::TYPE_STORE,
            'country_id' => $country->id,
            'is_national' => $national,
            'agency_id' => $agency?->id,
            'budget' => 50000,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => AdCampaign::STATUS_ACTIVE,
        ]);
    }

    private function country(string $code): Country
    {
        return Country::create([
            'name' => "Pays {$code}",
            'code' => $code,
            'currency_code' => 'XAF',
            'exchange_rate' => 1,
            'is_active' => true,
        ]);
    }

    private function user(string $role, ?Country $country = null): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
            'country_id' => $country?->id,
        ]);
    }
}
