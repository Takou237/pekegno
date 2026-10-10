<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\CommissionEntry;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Prestation;
use App\Models\PrestationOffer;
use App\Models\Role;
use App\Models\TeamMember;
use App\Models\User;
use Database\Seeders\ClientCategorySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Annuaire des équipiers Agency : CRUD avec/sans compte, liaison et création
 * de compte, affectation aux prestations, commissions sur encaissement et
 * page de suivi (missions).
 */
class TeamMemberTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            ClientCategorySeeder::class,
        ]);
    }

    private function manager(): User
    {
        $role = Role::where('name', 'super-admin')->firstOrFail();

        return User::factory()->create(['role_id' => $role->id]);
    }

    private function authManager(): string
    {
        $user = $this->manager();

        return $user->createToken('staff-token', ['*'])->plainTextToken;
    }

    private function agency(): Agency
    {
        return Agency::factory()->create();
    }

    public function test_manager_can_create_team_member_without_account(): void
    {
        $agency = $this->agency();

        $payload = $this->withToken($this->authManager())
            ->postJson('/api/team-members', [
                'agency_id' => $agency->id,
                'first_name' => 'Awa',
                'last_name' => 'Diallo',
                'phone' => '+237690000001',
                'commission_type' => 'percent',
                'commission_value' => 10,
            ])
            ->assertStatus(201)
            ->json();

        $this->assertSame('Awa', $payload['first_name']);
        $this->assertNull($payload['user_id'] ?? $payload['user']['id'] ?? null);
        $this->assertDatabaseHas('team_members', ['id' => $payload['id'], 'agency_id' => $agency->id]);
    }

    public function test_manager_can_create_account_for_team_member(): void
    {
        $agency = $this->agency();
        $member = TeamMember::create([
            'agency_id' => $agency->id,
            'first_name' => 'Awa',
            'last_name' => 'Diallo',
            'commission_type' => 'none',
        ]);

        $payload = $this->withToken($this->authManager())
            ->postJson("/api/team-members/{$member->id}/account", ['email' => 'awa@example.com'])
            ->assertStatus(201)
            ->json();

        $user = User::where('email', 'awa@example.com')->firstOrFail();
        $this->assertSame('community-manager', $user->role->name);
        $this->assertSame($user->id, $payload['user']['id']);
        $this->assertSame($user->id, $member->fresh()->user_id);
        // Profil employé créé aussitôt : visible dans la liste des employés.
        $this->assertDatabaseHas('commercials', [
            'user_id' => $user->id,
            'kind' => 'employe',
            'agency_id' => $agency->id,
        ]);
    }

    public function test_member_can_be_assigned_without_account_and_earns_commission_on_payment(): void
    {
        $agency = $this->agency();
        $member = TeamMember::create([
            'agency_id' => $agency->id,
            'first_name' => 'Awa',
            'last_name' => 'Diallo',
            'commission_type' => 'percent',
            'commission_value' => 10,
        ]);

        $offer = PrestationOffer::create(['agency_id' => $agency->id, 'name' => 'Boost', 'is_active' => true]);
        $client = User::where('role_id', Role::where('name', 'client')->first()->id)->first()
            ?? User::factory()->create(['role_id' => Role::where('name', 'client')->first()->id]);

        $prestation = Prestation::create([
            'reference' => 'TEST-001',
            'agency_id' => $agency->id,
            'offer_id' => $offer->id,
            'name' => 'Boost',
            'client_id' => $client->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'budget' => 100000,
            'status' => 'validated',
            'created_by' => $this->manager()->id,
        ]);

        // Affectation sans compte.
        $this->withToken($this->authManager())
            ->postJson("/api/prestations/{$prestation->id}/team", ['team_member_id' => $member->id])
            ->assertStatus(201);

        // Facture + encaissement sur la prestation.
        $contract = Contract::create([
            'number' => 'C-001',
            'client_id' => $client->id,
            'agency_id' => $agency->id,
            'prestation_id' => $prestation->id,
            'amount' => 100000,
            'status' => 'active',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
        ]);
        $invoice = Invoice::create([
            'number' => 'F-001',
            'client_id' => $client->id,
            'agency_id' => $agency->id,
            'contract_id' => $contract->id,
            'invoice_date' => '2026-11-15',
            'total_amount' => 100000,
            'status' => 'paid',
            'validation_status' => 'validated',
        ]);
        $invoice->items()->create([
            'prestation_id' => $prestation->id,
            'label' => 'Boost',
            'quantity' => 1,
            'unit_price' => 100000,
            'line_total' => 100000,
            'is_pass_through' => false,
        ]);
        $payment = $invoice->payments()->create(['amount' => 100000, 'payment_method' => 'cash', 'paid_at' => '2026-11-15']);

        app(\App\Services\CommissionService::class)->recordForPayment($invoice->fresh(), $payment);

        $entry = CommissionEntry::where('beneficiary_team_member_id', $member->id)->firstOrFail();
        $this->assertEquals(10000.0, (float) $entry->amount, '10 % des honoraires');
        $this->assertSame(CommissionEntry::STATUS_CALCULATED, $entry->status);
    }

    public function test_missions_returns_my_prestations_and_actions(): void
    {
        $agency = $this->agency();
        $role = Role::where('name', 'community-manager')->firstOrFail();
        $user = User::factory()->create(['role_id' => $role->id]);
        $member = TeamMember::create([
            'agency_id' => $agency->id,
            'first_name' => 'Bob',
            'last_name' => 'Lee',
            'user_id' => $user->id,
            'commission_type' => 'none',
        ]);

        $client = User::factory()->create(['role_id' => Role::where('name', 'client')->first()->id]);
        $prestation = Prestation::create([
            'reference' => 'TEST-002',
            'agency_id' => $agency->id,
            'name' => 'Boost',
            'client_id' => $client->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'budget' => 50000,
            'status' => 'in_progress',
            'created_by' => $this->manager()->id,
        ]);
        $prestation->teamMembers()->create(['user_id' => $user->id, 'team_member_id' => $member->id]);
        $action = $prestation->actions()->create([
            'title' => 'Publier le visuel',
            'type' => 'content_production',
            'status' => 'todo',
            'assigned_to' => $user->id,
        ]);

        $token = $user->createToken('staff-token', ['*'])->plainTextToken;

        $payload = $this->withToken($token)
            ->getJson('/api/team/missions')
            ->assertOk()
            ->json();

        $this->assertCount(1, $payload['prestations']);
        $this->assertSame('Boost', $payload['prestations'][0]['name']);
        $this->assertArrayHasKey('department_id', $payload['prestations'][0]);
        $this->assertArrayHasKey('department_id', $payload['actions'][0]['prestation']);
        $this->assertCount(1, $payload['actions']);
        $this->assertSame($action->id, $payload['actions'][0]['id']);
        $this->assertSame(1, $payload['open_actions']);
    }

    public function test_available_users_is_searchable_and_scoped_by_agency(): void
    {
        $agency = $this->agency();
        $other = $this->agency();
        $role = Role::where('name', 'community-manager')->firstOrFail();
        $mine = User::factory()->create(['role_id' => $role->id, 'first_name' => 'Koba', 'last_name' => 'La']);
        $mine->assignments()->attach($agency->id, ['is_primary' => false, 'is_department_chief' => false, 'department_id' => null]);
        $stranger = User::factory()->create(['role_id' => $role->id, 'first_name' => 'Zoe', 'last_name' => 'X']);
        $stranger->assignments()->attach($other->id, ['is_primary' => false, 'is_department_chief' => false, 'department_id' => null]);

        $token = $this->authManager();

        $scoped = $this->withToken($token)
            ->getJson("/api/team-members/available-users?agency_id={$agency->id}")
            ->assertOk()
            ->json();

        $this->assertCount(1, $scoped);
        $this->assertSame($mine->id, $scoped[0]['id']);

        $searched = $this->withToken($token)
            ->getJson('/api/team-members/available-users?search=koba')
            ->assertOk()
            ->json();

        $this->assertCount(1, $searched);
        $this->assertSame($mine->id, $searched[0]['id']);
    }

    public function test_missions_is_open_to_any_staff_role_and_includes_action_only_prestations(): void
    {
        $agency = $this->agency();
        $caissier = User::factory()->create(['role_id' => Role::where('name', 'caissier')->first()->id]);
        $client = User::factory()->create(['role_id' => Role::where('name', 'client')->first()->id]);

        $prestation = Prestation::create([
            'reference' => 'TEST-003',
            'agency_id' => $agency->id,
            'name' => 'Boost',
            'client_id' => $client->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'budget' => 50000,
            'status' => 'in_progress',
            'created_by' => $this->manager()->id,
        ]);
        // Action assignée sans affectation à l'équipe.
        $prestation->actions()->create([
            'title' => 'Relance client',
            'type' => 'other',
            'status' => 'todo',
            'assigned_to' => $caissier->id,
        ]);

        $token = $caissier->createToken('staff-token', ['*'])->plainTextToken;

        $payload = $this->withToken($token)
            ->getJson('/api/team/missions')
            ->assertOk()
            ->json();

        $this->assertCount(1, $payload['prestations']);
        $this->assertSame('Boost', $payload['prestations'][0]['name']);
        $this->assertSame([], $payload['prestations'][0]['roles']);
        $this->assertCount(1, $payload['actions']);
    }
}
