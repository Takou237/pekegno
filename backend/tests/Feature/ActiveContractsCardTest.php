<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Contract;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * B21 — « Abonnements actifs » compte les contrats ouverts (active +
 * due_soon), pas les anciennes subscriptions.
 */
class ActiveContractsCardTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $this->agency = Agency::factory()->create();
        $this->client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
    }

    private function contract(string $number, string $status): Contract
    {
        return Contract::create([
            'number' => $number,
            'client_id' => $this->client->id,
            'agency_id' => $this->agency->id,
            'start_date' => '2026-11-01',
            'end_date' => '2027-11-01',
            'billing_cycle' => 'yearly',
            'amount' => 100000,
            'status' => $status,
        ]);
    }

    public function test_cards_count_open_contracts_not_legacy_subscriptions(): void
    {
        foreach (range(1, 5) as $i) {
            $this->contract("CTR-ACT-{$i}", Contract::STATUS_ACTIVE);
        }
        foreach (range(1, 3) as $i) {
            $this->contract("CTR-DUE-{$i}", Contract::STATUS_DUE_SOON);
        }
        $this->contract('CTR-TERM-1', Contract::STATUS_TERMINATED);

        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));

        $period = 'from=2026-11-01&to=2026-11-30';

        $this->getJson("/api/stats/group?{$period}")
            ->assertOk()
            ->assertJsonPath('subscriptions_active', 8);

        $this->getJson("/api/reports/subscriptions?{$period}")
            ->assertOk()
            ->assertJsonPath('totals.active_contracts', 8);
    }
}
