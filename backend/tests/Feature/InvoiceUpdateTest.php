<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    public function test_client_changes_are_persisted_and_visible_to_commercial_and_cashier(): void
    {
        $agency = Agency::factory()->create();
        $commercialUser = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        $commercial = Commercial::factory()->create([
            'user_id' => $commercialUser->id,
            'agency_id' => $agency->id,
        ]);
        $oldClient = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        $newClient = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
            'first_name' => 'Nouvelle',
            'last_name' => 'Cliente',
        ]);
        $invoice = Invoice::create([
            'number' => 'INV-UPDATE-001',
            'agency_id' => $agency->id,
            'client_id' => $oldClient->id,
            'commercial_id' => $commercial->id,
            'seller_user_id' => $commercialUser->id,
            'created_by' => $commercialUser->id,
            'invoice_date' => now(),
            'total_amount' => 10000,
            'amount_paid' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_PENDING,
        ]);

        Sanctum::actingAs($commercialUser);
        $this->putJson("/api/invoices/{$invoice->id}", [
            'client_name' => 'Client libre',
        ])->assertOk()
            ->assertJsonPath('client_id', null)
            ->assertJsonPath('client_label', 'Client libre');

        $this->putJson("/api/invoices/{$invoice->id}", [
            'client_id' => $newClient->id,
        ])->assertOk()
            ->assertJsonPath('client_name', null)
            ->assertJsonPath('client_label', 'Nouvelle Cliente');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'client_id' => $newClient->id,
            'client_name' => null,
            'total_amount' => 10000,
        ]);

        $this->getJson('/api/invoices?per_page=100')
            ->assertOk()
            ->assertJsonPath('invoices.data.0.client_label', 'Nouvelle Cliente');

        $cashier = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
        ]);
        DB::table('user_assignments')->insert([
            'user_id' => $cashier->id,
            'agency_id' => $agency->id,
            'is_primary' => true,
            'is_department_chief' => false,
        ]);
        Sanctum::actingAs($cashier);

        $this->getJson('/api/invoices?per_page=100')
            ->assertOk()
            ->assertJsonPath('invoices.data.0.client_label', 'Nouvelle Cliente');
    }

    public function test_pending_invoice_payment_type_and_full_sale_details_are_saved(): void
    {
        $agency = Agency::factory()->create();
        $commercialUser = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        $commercial = Commercial::factory()->create([
            'user_id' => $commercialUser->id,
            'agency_id' => $agency->id,
        ]);
        $client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        $invoice = Invoice::create([
            'number' => 'INV-UPDATE-002',
            'agency_id' => $agency->id,
            'client_id' => $client->id,
            'commercial_id' => $commercial->id,
            'seller_user_id' => $commercialUser->id,
            'created_by' => $commercialUser->id,
            'invoice_date' => now(),
            'total_amount' => 10000,
            'amount_paid' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_PENDING,
        ]);
        $item = InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'label' => 'Ancien article',
            'unit_price' => 10000,
            'quantity' => 1,
            'line_total' => 10000,
        ]);

        Sanctum::actingAs($commercialUser);
        $this->putJson("/api/invoices/{$invoice->id}", [
            'client_id' => $client->id,
            'commercial_id' => $commercial->id,
            'invoice_date' => '2026-10-20',
            'payment_type' => 'om',
            'payer_phone' => '+237 690000000',
            'advance' => 1000,
            'discount' => 1000,
            'vat_rate' => 10,
            'comment' => 'Vente modifiée',
            'items' => [[
                'id' => $item->id,
                'label' => 'Article modifié',
                'unit_price' => 3000,
                'quantity' => 2,
            ]],
        ])->assertOk()
            ->assertJsonPath('payment_type', 'om')
            ->assertJsonPath('payer_phone', '+237 690000000')
            ->assertJsonPath('total_amount', '5500.00')
            ->assertJsonPath('declared_advance', '1000.00')
            ->assertJsonPath('items.0.label', 'Article modifié')
            ->assertJsonPath('items.0.quantity', 2);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'payment_type' => 'om',
            'payer_phone' => '+237 690000000',
            'total_amount' => 5500,
            'discount' => 1000,
            'vat_rate' => 10,
        ]);
        $this->assertDatabaseHas('invoice_items', [
            'id' => $item->id,
            'label' => 'Article modifié',
            'unit_price' => 3000,
            'quantity' => 2,
            'line_total' => 6000,
        ]);
    }
}
