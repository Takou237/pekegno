<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * T8.2 : le même client, le même montant à moins de 7 jours déclenche une
 * alerte non bloquante dans la réponse de création.
 */
class InvoiceDuplicateWarningTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $client;

    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Carbon::setTestNow('2026-11-10 10:00:00');

        $this->admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        $this->client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        $this->agency = Agency::factory()->create();
        Sanctum::actingAs($this->admin);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function createInvoice(float $amount, array $extra = []): array
    {
        return $this->postJson('/api/invoices', array_merge([
            'agency_id' => $this->agency->id,
            'client_id' => $this->client->id,
            'advance' => 1000,
            'items' => [
                ['label' => 'Prestation', 'unit_price' => $amount, 'quantity' => 1],
            ],
        ], $extra))->assertCreated()->json();
    }

    public function test_same_client_and_amount_within_seven_days_returns_a_warning(): void
    {
        $first = $this->createInvoice(50000);
        $second = $this->createInvoice(50000);

        $this->assertArrayNotHasKey('duplicate_warning', $first);
        $this->assertSame($first['number'], $second['duplicate_warning']['number']);
        $this->assertEquals(50000.0, $second['duplicate_warning']['total_amount']);
    }

    public function test_no_warning_for_another_amount_or_after_the_window(): void
    {
        $this->createInvoice(50000, ['invoice_date' => '2026-11-01']);

        $otherAmount = $this->createInvoice(80000);
        $this->assertArrayNotHasKey('duplicate_warning', $otherAmount);

        $later = $this->createInvoice(50000);
        $this->assertArrayNotHasKey('duplicate_warning', $later);
    }

    public function test_no_warning_for_another_client(): void
    {
        $this->createInvoice(50000);

        $other = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);

        $invoice = $this->createInvoice(50000, ['client_id' => $other->id]);

        $this->assertArrayNotHasKey('duplicate_warning', $invoice);
    }
}
