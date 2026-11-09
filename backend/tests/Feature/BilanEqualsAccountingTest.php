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
 * B12 — le Bilan (encaissé) et la Comptabilité (écritures `income`) doivent
 * afficher le même montant pour le même jour et la même agence.
 */
class BilanEqualsAccountingTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class, AccountingCategorySeeder::class]);

        $this->agency = Agency::factory()->create();
        $this->admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
    }

    private function cashBoxId(string $agencyId): string
    {
        return app(\App\Services\TreasuryAccountProvisioner::class)
            ->ensureAccount(Agency::findOrFail($agencyId), 'C')->id;
    }

    public function test_bilan_and_accounting_show_the_same_collected_and_expenses(): void
    {
        $today = Period::businessToday()->toDateString();

        // Encaissement : 25 000 en espèces (crée le paiement + l'écriture income).
        Sanctum::actingAs($this->admin);
        $this->postJson('/api/invoices', [
            'agency_id' => $this->agency->id,
            'items' => [['label' => 'Formation', 'unit_price' => 25000, 'quantity' => 1]],
            'advance' => 25000,
            'payment_type' => 'cash',
        ])->assertStatus(201);

        // Dépense : 2 000 sortis de la caisse C.
        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Achat carburant',
            'amount' => 2000,
            'agency_id' => $this->agency->id,
            'treasury_account_id' => $this->cashBoxId($this->agency->id),
            'beneficiary' => 'Station Total',
            'justification' => 'Déplacement',
        ])->assertStatus(201);

        $bilan = $this->getJson("/api/bilans?agency_id={$this->agency->id}&date={$today}")
            ->assertOk()
            ->json();

        $accounting = $this->getJson("/api/accounting/transactions?agency_id={$this->agency->id}")
            ->assertOk()
            ->json();

        $this->assertSame(25000.0, (float) $bilan['total_received']);
        $this->assertSame(2000.0, (float) $bilan['expense_total']);

        $this->assertSame((float) $bilan['total_received'], (float) $accounting['totals']['income']);
        $this->assertSame((float) $bilan['expense_total'], (float) $accounting['totals']['expense']);
    }

    public function test_the_shared_metric_and_accounting_agree_on_collected(): void
    {
        $today = Period::businessToday()->toDateString();

        Sanctum::actingAs($this->admin);
        $this->postJson('/api/invoices', [
            'agency_id' => $this->agency->id,
            'items' => [['label' => 'Formation', 'unit_price' => 40000, 'quantity' => 1]],
            'advance' => 40000,
            'payment_type' => 'cash',
        ])->assertStatus(201);

        $metrics = $this->getJson("/api/metrics/summary?from={$today}&to={$today}&agency_id={$this->agency->id}")
            ->assertOk()
            ->json();

        $accounting = $this->getJson("/api/accounting/transactions?agency_id={$this->agency->id}")
            ->assertOk()
            ->json();

        $this->assertSame(
            (float) $metrics['encaisse'],
            (float) $accounting['totals']['income'],
            'Le service financier et la comptabilité doivent compter le même encaissé.'
        );
    }
}
