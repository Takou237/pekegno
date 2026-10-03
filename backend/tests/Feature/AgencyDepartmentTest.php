<?php

namespace Tests\Feature;

use App\Mail\ContractRenewalReminderMail;
use App\Models\Activity;
use App\Models\Agency;
use App\Models\AgencyNotification;
use App\Models\Commercial;
use App\Models\CommissionEntry;
use App\Models\CommissionRule;
use App\Models\Contract;
use App\Models\Department;
use App\Models\Invoice;
use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\SubscriptionPack;
use App\Models\User;
use App\Services\AgencyAlertService;
use App\Services\BilanService;
use App\Services\SubscriptionMigrationService;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Département Agency — décisions D1 → D18 (doc/AGENCY_A_FAIRE.md §3, §5.5).
 */
class AgencyDepartmentTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private Department $department;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            CitySeeder::class,
        ]);

        $this->agency = Agency::factory()->create();
        $this->department = Department::factory()->create([
            'agency_id' => $this->agency->id,
            'type' => Department::TYPE_AGENCY,
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private function userWithRole(string $role, ?Agency $agency = null, bool $isChief = false): User
    {
        $user = User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);

        if ($agency) {
            DB::table('user_assignments')->insert([
                'user_id' => $user->id,
                'agency_id' => $agency->id,
                'department_id' => null,
                'is_primary' => $isChief,
                'is_department_chief' => false,
            ]);
        }

        return $user;
    }

    private function actingAsRole(string $role, ?Agency $agency = null, bool $isChief = false): User
    {
        $user = $this->userWithRole($role, $agency, $isChief);
        Sanctum::actingAs($user);

        return $user;
    }

    /** Le portail client exige un jeton nommé `client-token` (EnsurePortal). */
    private function actingAsClient(User $client): void
    {
        $client->withAccessToken($client->createToken('client-token')->accessToken);
        $this->actingAs($client, 'sanctum');
    }

    private function admin(): User
    {
        return $this->actingAsRole('super-admin');
    }

    private function client(): User
    {
        return $this->userWithRole('client');
    }

    private function commercial(?User $user = null): Commercial
    {
        return Commercial::factory()->create([
            'agency_id' => $this->agency->id,
            'user_id' => $user?->id,
            'commission_type' => 'none',
            'commission_value' => 0,
        ]);
    }

    private function createPackage(array $overrides = []): array
    {
        return $this->postJson('/api/packages', array_merge([
            'agency_id' => $this->agency->id,
            'department_id' => $this->department->id,
            'name' => 'Offre Starter',
            'tagline' => 'Lancez votre machine digitale',
            'price_per_month' => 299000,
            'original_price' => 370000,
            'billing_period' => 'monthly',
            'items' => [
                ['label' => 'Campagne Facebook & Instagram', 'quantity' => 1, 'frequency' => 'per_month', 'action_type' => 'advertising'],
                ['label' => 'Coaching du community manager', 'quantity' => 4, 'frequency' => 'per_month', 'action_type' => 'coaching'],
            ],
            'recommendations' => [
                ['label' => 'Community manager', 'quantity' => 1],
                ['label' => 'Commerciaux', 'quantity' => 2],
            ],
        ], $overrides))->assertStatus(201)->json();
    }

    private function createPrestation(User $client, array $overrides = []): array
    {
        return $this->postJson('/api/prestations', array_merge([
            'agency_id' => $this->agency->id,
            'department_id' => $this->department->id,
            'name' => 'Lancement réseaux sociaux',
            'client_id' => $client->id,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addMonth()->toDateString(),
            'budget' => 500000,
        ], $overrides))->assertStatus(201)->json();
    }

    private function validatedPrestation(User $client, array $overrides = []): Prestation
    {
        $p = $this->createPrestation($client, $overrides);
        $this->postJson("/api/prestations/{$p['id']}/submit")->assertOk();
        $this->postJson("/api/prestations/{$p['id']}/validate")->assertOk();

        return Prestation::findOrFail($p['id']);
    }

    private function pay(Invoice $invoice, float $amount): void
    {
        $this->postJson("/api/invoices/{$invoice->id}/payments", [
            'amount' => $amount,
            'payment_method' => 'cash',
        ])->assertOk();
    }

    // ─── Packages & souscription (D1, D3) ────────────────────────────────

    public function test_package_has_items_recommendations_and_effective_price_with_promotion(): void
    {
        $this->admin();
        $package = $this->createPackage();

        $this->assertCount(2, $package['items']);
        $this->assertCount(2, $package['recommendations']);
        $this->assertEquals(299000, $package['effective_price']);

        $this->postJson("/api/packages/{$package['id']}/promotions", [
            'type' => 'percent',
            'discount_percent' => 10,
            'start_date' => today()->subDay()->toDateString(),
            'end_date' => today()->addDays(10)->toDateString(),
        ])->assertStatus(201);

        $this->getJson("/api/packages/{$package['id']}")
            ->assertOk()
            ->assertJsonPath('effective_price', 269100);
    }

    public function test_subscribing_to_two_packages_creates_two_contracts_and_prefilled_prestations(): void
    {
        $this->admin();
        $client = $this->client();
        $starter = $this->createPackage();
        $shooting = $this->createPackage(['name' => 'Shooting', 'price_per_month' => 50000, 'original_price' => null, 'items' => [
            ['label' => 'Shooting photo', 'quantity' => 1, 'frequency' => 'per_month', 'action_type' => 'content_production'],
        ]]);

        $first = $this->postJson("/api/packages/{$starter['id']}/subscribe", ['client_id' => $client->id, 'periods' => 3])
            ->assertStatus(201)->json();
        $this->postJson("/api/packages/{$shooting['id']}/subscribe", ['client_id' => $client->id, 'periods' => 1])
            ->assertStatus(201);

        $this->assertSame(2, Contract::where('client_id', $client->id)->where('origin', 'package')->count());
        $this->assertSame(2, Prestation::where('client_id', $client->id)->count());

        $this->assertEquals(897000, $first['contract']['amount']);
        $this->assertSame('pending', $first['contract']['status']);
        $this->assertSame('validated', $first['prestation']['status']);
        $this->assertCount(2, $first['prestation']['actions'], 'une action par item du package (D3)');
        $this->assertEquals(897000, $first['invoice']['total_amount']);
        $this->assertSame($first['contract']['id'], $first['invoice']['contract_id']);
    }

    public function test_subscription_requires_client_role(): void
    {
        $this->admin();
        $package = $this->createPackage();
        $notAClient = $this->userWithRole('caissier');

        $this->postJson("/api/packages/{$package['id']}/subscribe", ['client_id' => $notAClient->id, 'periods' => 1])
            ->assertStatus(422);
    }

    // ─── Prestations, validation, contrat (D9, D10) ──────────────────────

    public function test_validating_a_prestation_creates_a_pending_contract_with_allocated_budget(): void
    {
        $this->admin();
        $prestation = $this->validatedPrestation($this->client());

        $contract = Contract::where('prestation_id', $prestation->id)->firstOrFail();
        $this->assertSame('prestation', $contract->origin);
        $this->assertSame('pending', $contract->status);
        $this->assertEquals(500000, (float) $contract->budget_allocated);
        $this->assertSame($contract->id, $prestation->contract_id);
        $this->assertSame(1, Invoice::where('contract_id', $contract->id)->count());
    }

    public function test_first_payment_activates_contract_and_starts_prestation(): void
    {
        $this->admin();
        $prestation = $this->validatedPrestation($this->client());
        $invoice = Invoice::where('contract_id', $prestation->contract_id)->firstOrFail();

        $this->pay($invoice, 100000);

        $this->assertSame('active', $prestation->contract->fresh()->status);
        $this->assertNotNull($prestation->contract->fresh()->activated_at);
        $this->assertSame('in_progress', $prestation->fresh()->status);
    }

    public function test_signed_pdf_alone_does_not_activate_contract(): void
    {
        $this->admin();
        $prestation = $this->validatedPrestation($this->client());

        $this->postJson("/api/contracts/{$prestation->contract_id}/sign", ['signed_document_path' => 'uploads/contrat-signe.pdf'])
            ->assertOk();

        $this->assertSame('pending', $prestation->contract->fresh()->status);
    }

    public function test_commercial_cannot_validate_and_chief_outside_scope_is_forbidden(): void
    {
        $this->admin();
        $prestation = $this->createPrestation($this->client());
        $this->postJson("/api/prestations/{$prestation['id']}/submit")->assertOk();

        $this->actingAsRole('commercial', $this->agency);
        $this->postJson("/api/prestations/{$prestation['id']}/validate")->assertStatus(403);

        $this->actingAsRole('responsable-agence', Agency::factory()->create(), isChief: true);
        $this->postJson("/api/prestations/{$prestation['id']}/validate")->assertStatus(403);

        $this->actingAsRole('responsable-agence', $this->agency, isChief: true);
        $this->postJson("/api/prestations/{$prestation['id']}/validate")->assertOk()->assertJsonPath('status', 'validated');
    }

    public function test_forbidden_transition_and_missing_reason_are_rejected(): void
    {
        $this->admin();
        $prestation = $this->validatedPrestation($this->client());
        $prestation->update(['status' => 'completed']);

        $this->postJson("/api/prestations/{$prestation->id}/back-to-draft")->assertStatus(422);

        $other = $this->validatedPrestation($this->client());
        $this->postJson("/api/prestations/{$other->id}/suspend", ['reason' => ''])->assertStatus(422);
        $this->postJson("/api/prestations/{$other->id}/suspend", ['reason' => 'Client injoignable'])
            ->assertOk()
            ->assertJsonPath('status_reason', 'Client injoignable');

        $this->assertSame('suspended', $other->contract->fresh()->status);
    }

    // ─── Budget des actions (D4) ─────────────────────────────────────────

    public function test_action_budget_is_strictly_capped_by_prestation_budget(): void
    {
        $this->admin();
        $p = $this->createPrestation($this->client());

        $this->postJson("/api/prestations/{$p['id']}/actions", [
            'title' => '3 vidéos Facebook par semaine', 'quantity' => 3, 'frequency' => 'per_week',
            'type' => 'community_management', 'budget' => 150000,
        ])->assertStatus(201);
        $this->postJson("/api/prestations/{$p['id']}/actions", [
            'title' => 'Publicité Facebook', 'type' => 'advertising', 'budget' => 300000, 'is_pass_through' => true,
        ])->assertStatus(201);

        $this->postJson("/api/prestations/{$p['id']}/actions", ['title' => 'Shooting', 'budget' => 100000])
            ->assertStatus(422)
            ->assertJsonValidationErrors('budget');

        $this->getJson("/api/prestations/{$p['id']}/actions")
            ->assertOk()
            ->assertJsonPath('budget.allocated', 450000)
            ->assertJsonPath('budget.remaining', 50000);
    }

    // ─── Notation (D5, D11, D12) ─────────────────────────────────────────

    public function test_client_rates_each_action_once_and_can_modify_it(): void
    {
        $this->admin();
        $client = $this->client();
        $prestation = $this->validatedPrestation($client);
        $actions = collect(['A', 'B', 'C'])->map(fn ($t) => $this->postJson("/api/prestations/{$prestation->id}/actions", ['title' => $t])->json('id'));
        $this->pay(Invoice::where('contract_id', $prestation->contract_id)->firstOrFail(), 1000);

        $this->actingAsClient($client);
        foreach ([[0, 5], [1, 4], [2, 3]] as [$i, $rating]) {
            $this->putJson("/api/client/prestation-actions/{$actions[$i]}/review", ['rating' => $rating])->assertOk();
        }
        $this->assertEquals(4.0, (float) $prestation->fresh()->rating_avg);

        $this->putJson("/api/client/prestation-actions/{$actions[2]}/review", ['rating' => 4])->assertOk();

        $prestation->refresh();
        $this->assertSame(3, $prestation->rating_count);
        $this->assertEquals(4.3, (float) $prestation->rating_avg);
        $this->assertDatabaseCount('prestation_action_reviews', 3);

        $this->putJson("/api/client/prestation-actions/{$actions[0]}/review", ['rating' => 6])->assertStatus(422);
    }

    public function test_only_the_prestation_client_can_rate_and_only_when_in_progress_or_completed(): void
    {
        $this->admin();
        $client = $this->client();
        $p = $this->createPrestation($client);
        $actionId = $this->postJson("/api/prestations/{$p['id']}/actions", ['title' => 'Action'])->json('id');

        $this->actingAsClient($client);
        $this->putJson("/api/client/prestation-actions/{$actionId}/review", ['rating' => 5])->assertStatus(422);

        $this->actingAsClient($this->client());
        $this->putJson("/api/client/prestation-actions/{$actionId}/review", ['rating' => 5])->assertStatus(404);

        $this->admin();
        $this->putJson("/api/client/prestation-actions/{$actionId}/review", ['rating' => 5])->assertStatus(403);
    }

    // ─── Commissions (D6, D13, D17) ──────────────────────────────────────

    public function test_prestation_outside_package_uses_its_own_commission_rate_on_payment(): void
    {
        $this->admin();
        $commercial = $this->commercial();
        $prestation = $this->validatedPrestation($this->client(), [
            'budget' => 100000,
            'commercial_id' => $commercial->id,
            'commission_type' => 'percent',
            'commission_value' => 10,
        ]);
        $invoice = Invoice::where('contract_id', $prestation->contract_id)->firstOrFail();

        $this->pay($invoice, 100000);

        $entry = CommissionEntry::where('invoice_id', $invoice->id)->firstOrFail();
        $this->assertEquals(10000, (float) $entry->amount);
        $this->assertSame($commercial->id, $entry->beneficiary_commercial_id);
        $this->assertSame('prestation', $entry->product_type);
    }

    public function test_package_commission_rule_applies_on_each_payment(): void
    {
        $admin = $this->admin();
        $commercial = $this->commercial();
        $package = $this->createPackage(['price_per_month' => 100000, 'original_price' => null]);

        CommissionRule::create([
            'rule_group_id' => (string) \Illuminate\Support\Str::uuid(),
            'version' => 1,
            'name' => 'Starter 5 %',
            'package_id' => $package['id'],
            'trigger_event' => 'on_payment',
            'formula_type' => 'percent',
            'percent_value' => 5,
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        $result = $this->postJson("/api/packages/{$package['id']}/subscribe", [
            'client_id' => $this->client()->id, 'periods' => 1, 'commercial_id' => $commercial->id,
        ])->assertStatus(201)->json();

        $invoice = Invoice::findOrFail($result['invoice']['id']);
        $this->pay($invoice, 40000);
        $this->pay($invoice, 60000);

        $this->assertEquals(5000, (float) CommissionEntry::where('invoice_id', $invoice->id)->sum('amount'));
        $this->assertSame(2, CommissionEntry::where('invoice_id', $invoice->id)->count());
    }

    // ─── Bilan (D7, D15) ─────────────────────────────────────────────────

    public function test_daily_bilan_excludes_client_ad_budget_from_revenue(): void
    {
        $this->admin();
        $p = $this->createPrestation($this->client(), ['budget' => 400000]);
        $this->postJson("/api/prestations/{$p['id']}/actions", ['title' => 'Pub Facebook', 'type' => 'advertising', 'budget' => 300000, 'is_pass_through' => true])->assertStatus(201);
        $this->postJson("/api/prestations/{$p['id']}/submit")->assertOk();
        $this->postJson("/api/prestations/{$p['id']}/validate")->assertOk();

        $invoice = Invoice::where('contract_id', Prestation::find($p['id'])->contract_id)->firstOrFail();
        $this->assertSame(2, $invoice->items()->count());
        $this->pay($invoice, 400000);

        $bilan = app(BilanService::class)->daily(Carbon::parse(today()), $this->agency->id);

        $this->assertEquals(100000, $bilan['agency_total']);
        $this->assertEquals(300000, $bilan['agency_pass_through_total']);
        $this->assertEquals(100000, $bilan['total_ventes_amount']);
        $this->assertEquals(400000, $bilan['total_received']);
    }

    // ─── Renouvellements (D8, D14, D18) ──────────────────────────────────

    public function test_renewal_alerts_go_to_agency_chief_and_client_once_per_threshold(): void
    {
        Mail::fake();
        $this->admin();
        $chief = $this->userWithRole('responsable-agence', $this->agency, isChief: true);
        $commercialUser = $this->userWithRole('commercial', $this->agency);
        $client = $this->client();

        $prestation = $this->validatedPrestation($client, [
            'commercial_id' => $this->commercial($commercialUser)->id,
            'end_date' => today()->addDays(10)->toDateString(),
        ]);
        $this->pay(Invoice::where('contract_id', $prestation->contract_id)->firstOrFail(), 1000);

        $alerts = app(AgencyAlertService::class);
        $alerts->run();
        $alerts->run();

        $contract = $prestation->contract->fresh();
        $this->assertSame('due_soon', $contract->status);

        $this->assertSame(1, AgencyNotification::where('user_id', $chief->id)->where('dedupe_key', "contract:{$contract->id}:renewal:J15")->count());
        $this->assertSame(1, AgencyNotification::where('user_id', $client->id)->where('type', 'contract_renewal')->count());
        $this->assertSame(0, AgencyNotification::where('user_id', $commercialUser->id)->where('type', 'contract_renewal')->count());
        $this->assertSame(1, Activity::where('assigned_to', $chief->id)->where('type', 'followup')->count());
        Mail::assertSent(ContractRenewalReminderMail::class, 1);

        $this->actingAsClient($client);
        $this->getJson('/api/client/notifications')->assertOk()->assertJsonPath('unread_count', 1);

        Carbon::setTestNow(today()->addDays(4));
        $alerts->run();
        $this->assertSame(1, AgencyNotification::where('user_id', $chief->id)->where('dedupe_key', "contract:{$contract->id}:renewal:J7")->count());
        Carbon::setTestNow();
    }

    public function test_renewal_alert_days_are_configurable_per_department(): void
    {
        $this->admin();

        $this->getJson("/api/departments/{$this->department->id}/agency-settings")
            ->assertOk()
            ->assertJsonPath('renew_alert_days', [30, 15, 7, 1]);

        $this->putJson("/api/departments/{$this->department->id}/agency-settings", ['renew_alert_days' => [3, 45]])
            ->assertOk()
            ->assertJsonPath('renew_alert_days', [45, 3]);
    }

    // ─── Reprise subscriptions → contracts (D1, D16) ─────────────────────

    public function test_subscription_history_migration_is_complete_and_idempotent(): void
    {
        $this->admin();
        $package = SubscriptionPack::create(['agency_id' => $this->agency->id, 'name' => 'Ancien pack', 'price_per_month' => 10000, 'is_active' => true]);
        $client = $this->client();

        foreach (['active', 'cancelled', 'renewed'] as $status) {
            Subscription::create([
                'subscription_pack_id' => $package->id, 'agency_id' => $this->agency->id, 'client_id' => $client->id,
                'months' => 1, 'price_per_month' => 10000, 'total_price' => 10000,
                'start_date' => today()->subMonths(2)->toDateString(), 'end_date' => today()->addMonth()->toDateString(),
                'status' => $status,
            ]);
        }

        $service = app(SubscriptionMigrationService::class);
        $first = $service->migrate();
        $second = $service->migrate();

        $this->assertSame(3, $first['migrated']);
        $this->assertSame(0, $second['migrated']);
        $this->assertSame(3, $second['skipped']);
        $this->assertSame(['active', 'renewed', 'terminated'], Contract::whereNotNull('legacy_subscription_id')->orderBy('status')->pluck('status')->all());
    }

    public function test_subscriptions_become_read_only_when_switch_is_enabled(): void
    {
        $this->admin();
        config(['agency.subscriptions_read_only' => true]);

        $this->postJson('/api/subscriptions', [])->assertStatus(409);
    }

    // ─── Périmètre & suivi ───────────────────────────────────────────────

    public function test_commercial_and_community_manager_only_see_their_prestations(): void
    {
        $this->admin();
        $commercialUser = $this->userWithRole('commercial', $this->agency);
        $cmUser = $this->userWithRole('community-manager', $this->agency);

        $mine = $this->createPrestation($this->client(), ['commercial_id' => $this->commercial($commercialUser)->id]);
        $other = $this->createPrestation($this->client());
        $this->postJson("/api/prestations/{$other['id']}/team", ['user_id' => $cmUser->id])->assertStatus(201);

        Sanctum::actingAs($commercialUser);
        $this->getJson('/api/prestations')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine['id']);
        $this->getJson("/api/prestations/{$other['id']}")->assertStatus(403);

        Sanctum::actingAs($cmUser);
        $this->getJson('/api/prestations')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $other['id']);
    }

    public function test_tracking_table_exposes_name_rating_status_and_reason(): void
    {
        $this->admin();
        $prestation = $this->validatedPrestation($this->client());
        $this->postJson("/api/prestations/{$prestation->id}/suspend", ['reason' => 'Retard de paiement'])->assertOk();

        $this->getJson("/api/prestations/tracking?department_id={$this->department->id}")
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Lancement réseaux sociaux')
            ->assertJsonPath('data.0.status', 'suspended')
            ->assertJsonPath('data.0.status_reason', 'Retard de paiement')
            ->assertJsonPath('data.0.rating_avg', null);
    }

    public function test_overdue_action_notifies_assignee_once(): void
    {
        $this->admin();
        $cm = $this->userWithRole('community-manager', $this->agency);
        $p = $this->createPrestation($this->client());
        $this->postJson("/api/prestations/{$p['id']}/actions", [
            'title' => 'Vidéo', 'assigned_to' => $cm->id, 'due_date' => today()->subDay()->toDateString(),
        ])->assertStatus(201);

        $alerts = app(AgencyAlertService::class);
        $this->assertSame(1, $alerts->notifyOverdueActions());
        $this->assertSame(0, $alerts->notifyOverdueActions());
        $this->assertSame(1, AgencyNotification::where('user_id', $cm->id)->where('type', 'action_overdue')->count());
    }

    public function test_agency_report_returns_kpis(): void
    {
        $this->admin();
        $prestation = $this->validatedPrestation($this->client(), ['budget' => 200000]);
        $this->pay(Invoice::where('contract_id', $prestation->contract_id)->firstOrFail(), 50000);

        $this->getJson("/api/reports/agency?department_id={$this->department->id}")
            ->assertOk()
            ->assertJsonPath('kpis.collected', 50000)
            ->assertJsonPath('kpis.revenue', 50000)
            ->assertJsonPath('kpis.receivables', 150000)
            ->assertJsonPath('kpis.active_contracts', 1)
            ->assertJsonPath('kpis.prestations_in_progress', 1);
    }

    public function test_contract_pdf_is_downloadable(): void
    {
        $this->admin();
        $prestation = $this->validatedPrestation($this->client());

        $this->get("/api/contracts/{$prestation->contract_id}/pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    // ─── Comptabilité & bilan limités au département ─────────────────────

    public function test_bilan_and_accounting_are_scoped_to_the_department(): void
    {
        $this->admin();
        $otherDepartment = Department::factory()->create(['agency_id' => $this->agency->id, 'type' => Department::TYPE_AGENCY]);

        $mine = $this->validatedPrestation($this->client(), ['budget' => 100000]);
        $other = $this->validatedPrestation($this->client(), ['budget' => 70000, 'department_id' => $otherDepartment->id]);
        $this->pay(Invoice::where('contract_id', $mine->contract_id)->firstOrFail(), 100000);
        $this->pay(Invoice::where('contract_id', $other->contract_id)->firstOrFail(), 70000);

        $this->getJson("/api/bilans?department_id={$this->department->id}&date=".today()->toDateString())
            ->assertOk()
            ->assertJsonPath('department_id', $this->department->id)
            ->assertJsonPath('total_received', 100000)
            ->assertJsonPath('agency_total', 100000);

        $this->getJson("/api/bilans?agency_id={$this->agency->id}&date=".today()->toDateString())
            ->assertOk()
            ->assertJsonPath('total_received', 170000);

        $this->getJson("/api/accounting/transactions?department_id={$this->department->id}")
            ->assertOk()
            ->assertJsonPath('totals.income', 100000);
    }

    public function test_renewing_an_agency_contract_creates_invoice_and_can_be_activated(): void
    {
        $this->admin();
        $package = $this->createPackage(['price_per_month' => 100000, 'original_price' => null]);
        $result = $this->postJson("/api/packages/{$package['id']}/subscribe", ['client_id' => $this->client()->id, 'periods' => 1])
            ->assertStatus(201)->json();
        $this->pay(Invoice::findOrFail($result['invoice']['id']), 100000);

        $child = $this->postJson("/api/contracts/{$result['contract']['id']}/renew")->assertStatus(201)->json();

        $this->assertSame('pending', $child['status']);
        $this->assertSame('renewed', Contract::find($result['contract']['id'])->status);
        $childInvoice = Invoice::where('contract_id', $child['id'])->firstOrFail();
        $this->assertEquals(100000, (float) $childInvoice->total_amount);
        $this->assertSame(2, Prestation::where('package_id', $package['id'])->count());

        $this->pay($childInvoice, 50000);
        $this->assertSame('active', Contract::find($child['id'])->status);

        $this->postJson("/api/contracts/{$result['contract']['id']}/renew")->assertStatus(422);
    }
}

