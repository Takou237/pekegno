<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * T3.14 — rentabilité d'un événement.
 *
 * Décision client du 12/11/2026 : l'événement est le séminaire vendu au
 * catalogue. Sa rentabilité = ventes de la période − dépenses rattachées.
 */
class EventProfitabilityTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $admin;

    private Service $seminar;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->agency = Agency::factory()->create();
        $this->admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);

        $this->seminar = Service::factory()->create([
            'name' => 'Bootcamp 3 jours, Yaoundé',
            'agency_id' => $this->agency->id,
            'price' => 50000,
            'is_seminar' => true,
        ]);
    }

    private function invoiceLine(float $amount, int $quantity = 2): Invoice
    {
        $invoice = Invoice::create([
            'number' => 'PK-EV-'.uniqid(),
            'agency_id' => $this->agency->id,
            'invoice_date' => now()->toDateString(),
            'client_name' => 'Participant Bootcamp',
            'total_amount' => $amount,
            'amount_paid' => $amount,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'paid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'source' => 'in_person',
        ]);

        $invoice->items()->create([
            'label' => $this->seminar->name,
            'quantity' => $quantity,
            'unit_price' => $amount / $quantity,
            'line_total' => $amount,
            'service_id' => $this->seminar->id,
        ]);

        return $invoice;
    }

    public function test_event_profitability_subtracts_attached_expenses_from_sales(): void
    {
        $this->invoiceLine(100000, 2);

        Expense::create([
            'number' => Expense::generateNextNumber(),
            'agency_id' => $this->agency->id,
            'category_id' => \App\Models\AccountingCategory::create(['name' => 'Logistique', 'type' => 'expense'])::query()->value('id'),
            'amount' => 40000,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PAID,
            'requested_by' => $this->admin->id,
            'service_id' => $this->seminar->id,
        ]);

        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/reports/events')->assertOk()->json();

        $this->assertCount(1, $response['rows']);
        $row = $response['rows'][0];
        $this->assertSame($this->seminar->id, $row['service_id']);
        $this->assertEquals(100000, $row['revenue']);
        $this->assertEquals(40000, $row['expenses']);
        $this->assertEquals(60000, $row['margin']);
        $this->assertEquals(60, $row['margin_rate']);
        $this->assertSame(2, $row['tickets']);
    }

    public function test_expense_can_be_attached_to_a_seminar_of_the_same_agency_only(): void
    {
        Sanctum::actingAs($this->admin);

        $category = \App\Models\AccountingCategory::create(['name' => 'Logistique', 'type' => 'expense']);

        $this->postJson('/api/expenses', [
            'agency_id' => $this->agency->id,
            'category_id' => $category->id,
            'amount' => 15000,
            'expense_date' => now()->toDateString(),
            'service_id' => $this->seminar->id,
        ])->assertCreated()
            ->assertJsonPath('service_id', $this->seminar->id);

        $foreign = Service::factory()->create([
            'agency_id' => Agency::factory()->create()->id,
            'is_seminar' => true,
        ]);

        $this->postJson('/api/expenses', [
            'agency_id' => $this->agency->id,
            'category_id' => $category->id,
            'amount' => 15000,
            'expense_date' => now()->toDateString(),
            'service_id' => $foreign->id,
        ])->assertStatus(422);
    }
}
