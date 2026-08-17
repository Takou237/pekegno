<?php

namespace Tests\Feature;

use App\Models\AccountingCategory;
use App\Models\AccountingTransaction;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class Phase3AccountingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class, AccountingCategorySeeder::class]);
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function createInvoice(array $attributes = []): array
    {
        return $this->postJson('/api/invoices', array_merge([
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ], $attributes))->assertStatus(201)->json();
    }

    public function test_payment_records_income_transaction(): void
    {
        $this->actingAsAdmin();

        $client = $this->postJson('/api/clients', [
            'first_name' => 'Client',
            'last_name' => 'Compta',
            'email' => 'compta@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertStatus(201)->json();

        $invoice = $this->createInvoice(['client_id' => $client['id']]);

        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 5000,
            'payment_method' => 'cash',
        ])->assertOk();

        $this->assertDatabaseHas('accounting_transactions', [
            'type' => 'income',
            'label' => "Facture {$invoice['number']} — versement",
            'reference' => $invoice['number'],
            'amount' => 5000.00,
            'client_id' => $client['id'],
            'invoice_id' => $invoice['id'],
            'category_id' => AccountingCategory::where('name', 'Encaissement facture')->value('id'),
        ]);
    }

    public function test_advance_records_income_transaction(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice(['advance' => 3000, 'payment_type' => 'cash']);

        $this->assertDatabaseCount('accounting_transactions', 1);
        $this->assertDatabaseHas('accounting_transactions', [
            'type' => 'income',
            'amount' => 3000.00,
        ]);
    }

    public function test_expense_requires_beneficiary_and_justification(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Achat carburant',
            'amount' => 2000,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['beneficiary', 'justification']);

        $created = $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Achat carburant',
            'amount' => 2000,
            'beneficiary' => 'Station Total',
            'justification' => 'Déplacement direction',
            'note' => 'Fait le 15/08',
        ])->assertStatus(201);

        $this->assertDatabaseHas('accounting_transactions', [
            'id' => $created->json('id'),
            'type' => 'expense',
            'amount' => 2000.00,
            'beneficiary' => 'Station Total',
            'justification' => 'Déplacement direction',
        ]);
    }

    public function test_index_filters_and_totals(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/accounting/transactions', [
            'type' => 'income',
            'label' => 'Apport fonds',
            'amount' => 50000,
        ])->assertStatus(201);

        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Loyer',
            'amount' => 20000,
            'beneficiary' => 'Propriétaire',
            'justification' => 'Loyer août',
        ])->assertStatus(201);

        $res = $this->getJson('/api/accounting/transactions')
            ->assertOk()
            ->assertJsonCount(2, 'transactions.data');

        $res->assertJsonPath('totals.income', 50000)
            ->assertJsonPath('totals.expense', 20000)
            ->assertJsonPath('totals.balance', 30000);

        $this->getJson('/api/accounting/transactions?type=expense')
            ->assertOk()
            ->assertJsonCount(1, 'transactions.data')
            ->assertJsonPath('transactions.data.0.label', 'Loyer');

        $this->getJson('/api/accounting/transactions?search=Loyer')
            ->assertOk()
            ->assertJsonCount(1, 'transactions.data');
    }

    public function test_manual_transaction_can_be_updated_and_deleted(): void
    {
        $this->actingAsAdmin();

        $created = $this->postJson('/api/accounting/transactions', [
            'type' => 'income',
            'label' => 'Vente matériel',
            'amount' => 10000,
        ])->assertStatus(201)->json();

        $this->putJson("/api/accounting/transactions/{$created['id']}", [
            'label' => 'Vente matériel ancien',
            'amount' => 9000,
        ])->assertOk();

        $this->assertDatabaseHas('accounting_transactions', [
            'id' => $created['id'],
            'label' => 'Vente matériel ancien',
            'amount' => 9000.00,
        ]);

        $this->deleteJson("/api/accounting/transactions/{$created['id']}")->assertStatus(204);
        $this->assertDatabaseMissing('accounting_transactions', ['id' => $created['id']]);
    }

    public function test_auto_generated_transaction_is_protected(): void
    {
        $this->actingAsAdmin();

        $invoice = $this->createInvoice();
        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 5000,
            'payment_method' => 'cash',
        ])->assertOk();

        $transactionId = AccountingTransaction::where('invoice_id', $invoice['id'])->value('id');

        $this->putJson("/api/accounting/transactions/{$transactionId}", ['label' => 'Hack'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Une écriture générée automatiquement ne peut pas être modifiée.');

        $this->deleteJson("/api/accounting/transactions/{$transactionId}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Une écriture générée automatiquement ne peut pas être supprimée.');
    }

    public function test_system_categories_are_protected(): void
    {
        $this->actingAsAdmin();

        $category = AccountingCategory::where('name', 'Encaissement facture')->firstOrFail();

        $this->putJson("/api/accounting/categories/{$category->id}", ['name' => 'Hack'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Une catégorie système ne peut pas être modifiée.');

        $this->deleteJson("/api/accounting/categories/{$category->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Une catégorie système ne peut pas être supprimée.');
    }

    public function test_categories_crud_with_agency_scope(): void
    {
        $this->actingAsAdmin();

        $created = $this->postJson('/api/accounting/categories', [
            'name' => 'Transport',
            'type' => 'expense',
        ])->assertStatus(201)->json();

        $this->assertDatabaseHas('accounting_categories', ['id' => $created['id'], 'is_system' => false]);

        $this->getJson('/api/accounting/categories?type=expense')
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_accounting_export_downloads_xlsx(): void
    {
        Excel::fake();

        $this->actingAsAdmin();

        $this->postJson('/api/accounting/transactions', [
            'type' => 'income',
            'label' => 'Apport fonds',
            'amount' => 50000,
        ])->assertStatus(201);

        $this->getJson('/api/exports/accounting')
            ->assertOk();

        Excel::assertDownloaded('comptabilite-'.now()->format('Y-m-d').'.xlsx');
    }
}
