<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Role;
use App\Models\User;
use App\Support\Period;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Une facture non soldée ne s'imprime pas : chaque versement porte un
 * numéro de reçu (REC-AAAAMMJJ-NNN) et le détail de la facture expose le
 * caissier de chaque versement pour l'impression du reçu.
 */
class PaymentReceiptNumberTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_payment_gets_a_sequential_receipt_number(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class, AccountingCategorySeeder::class]);
        $cashier = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
        Sanctum::actingAs($cashier);

        $agency = Agency::factory()->create();
        $invoice = $this->postJson('/api/invoices', [
            'agency_id' => $agency->id,
            'items' => [['label' => 'Formation', 'unit_price' => 100000, 'quantity' => 1]],
        ])->assertCreated()->json();

        $this->postJson("/api/invoices/{$invoice['id']}/payments", ['amount' => 30000, 'payment_method' => 'cash'])->assertOk();
        $this->postJson("/api/invoices/{$invoice['id']}/payments", ['amount' => 20000, 'payment_method' => 'om'])->assertOk();

        $prefix = 'REC-'.Period::businessToday()->format('Ymd').'-';

        $this->getJson('/api/invoices/'.$invoice['id'])
            ->assertOk()
            ->assertJsonPath('status', 'partial')
            ->assertJsonPath('payments.0.receipt_number', $prefix.'001')
            ->assertJsonPath('payments.1.receipt_number', $prefix.'002')
            ->assertJsonPath('payments.0.receiver.id', $cashier->id);
    }
}
