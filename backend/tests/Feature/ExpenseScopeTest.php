<?php

namespace Tests\Feature;

use App\Models\AccountingCategory;
use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\Country;
use App\Models\Expense;
use App\Models\Role;
use App\Models\TreasuryAccount;
use App\Models\User;
use App\Services\TreasuryAccountProvisioner;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Cahier §5 : le chef d'agence « voit et valide tout ce qui concerne son
 * agence, rien des autres » — y compris dans le circuit des sorties et en
 * Comptabilité. N11 : seule l'Administration touche aux caisses de
 * l'Administration.
 */
class ExpenseScopeTest extends TestCase
{
    use RefreshDatabase;

    private Country $country;
    private Agency $douala;
    private Agency $yaounde;
    private AccountingCategory $category;
    private int $sequence = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->country = Country::create([
            'name' => 'Cameroun', 'code' => 'CM', 'currency_code' => 'XAF', 'exchange_rate' => 1, 'is_active' => true,
        ]);
        $this->douala = Agency::factory()->create(['name' => 'Douala', 'country_id' => $this->country->id]);
        $this->yaounde = Agency::factory()->create(['name' => 'Yaoundé', 'country_id' => $this->country->id]);
        $provisioner = app(TreasuryAccountProvisioner::class);
        $provisioner->ensureForAgency($this->douala);
        $provisioner->ensureForAgency($this->yaounde);
        $provisioner->ensureForAdministration($this->country);
        $this->category = AccountingCategory::create(['name' => 'Fournitures', 'type' => 'expense']);
    }

    // --- Circuit des sorties ------------------------------------------------------

    public function test_an_agency_manager_cannot_act_on_another_agency_expense(): void
    {
        $other = $this->expense($this->yaounde, Expense::STATUS_SUBMITTED);
        Sanctum::actingAs($this->user('responsable-agence', $this->douala));

        $this->getJson("/api/expenses/{$other->id}")->assertNotFound();
        $this->postJson("/api/expenses/{$other->id}/approve")->assertNotFound();
        $this->postJson("/api/expenses/{$other->id}/reject", ['reason' => 'Non'])->assertNotFound();
        $this->deleteJson("/api/expenses/{$other->id}")->assertNotFound();

        $this->assertSame(Expense::STATUS_SUBMITTED, $other->fresh()->status);
        $ids = collect($this->getJson('/api/expenses?per_page=50')->assertOk()->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($other->id));
    }

    public function test_an_agency_manager_still_handles_own_agency_expenses(): void
    {
        $own = $this->expense($this->douala, Expense::STATUS_SUBMITTED);
        Sanctum::actingAs($this->user('responsable-agence', $this->douala));

        $this->getJson("/api/expenses/{$own->id}")->assertOk();
        $this->postJson("/api/expenses/{$own->id}/approve")->assertOk();
        $this->postJson("/api/expenses/{$own->id}/pay", ['treasury_account_id' => $this->account($this->douala, 'C')->id])->assertOk();
        $this->assertSame(Expense::STATUS_PAID, $own->fresh()->status);
    }

    public function test_an_agency_manager_cannot_create_an_expense_for_another_agency(): void
    {
        Sanctum::actingAs($this->user('responsable-agence', $this->douala));

        $this->postJson('/api/expenses', [
            'agency_id' => $this->yaounde->id,
            'category_id' => $this->category->id,
            'amount' => 8000,
            'expense_date' => '2026-11-13',
        ])->assertForbidden();

        $this->assertSame(0, Expense::count());
    }

    public function test_a_cashier_cannot_pay_another_agency_expense_nor_from_a_hidden_cash_box(): void
    {
        $other = $this->expense($this->yaounde, Expense::STATUS_APPROVED);
        $own = $this->expense($this->douala, Expense::STATUS_APPROVED);
        Sanctum::actingAs($this->user('caissier', $this->douala));

        // Sortie de Yaoundé, depuis la caisse de Yaoundé : introuvable pour elle.
        $this->postJson("/api/expenses/{$other->id}/pay", ['treasury_account_id' => $this->account($this->yaounde, 'C')->id])->assertNotFound();
        // Sortie de Douala, depuis la caisse O (qu'elle ne voit pas) : refusé.
        $this->postJson("/api/expenses/{$own->id}/pay", ['treasury_account_id' => $this->account($this->douala, 'O')->id])->assertForbidden();
        // Depuis sa caisse C : accepté.
        $this->postJson("/api/expenses/{$own->id}/pay", ['treasury_account_id' => $this->account($this->douala, 'C')->id])->assertOk();

        $this->assertSame(Expense::STATUS_APPROVED, $other->fresh()->status);
        $this->assertSame(0, $this->account($this->yaounde, 'C')->transactions()->count());
    }

    public function test_a_cashier_list_is_limited_to_her_agency(): void
    {
        $own = $this->expense($this->douala, Expense::STATUS_DRAFT);
        $other = $this->expense($this->yaounde, Expense::STATUS_DRAFT);
        $administration = $this->expense(null, Expense::STATUS_DRAFT);
        Sanctum::actingAs($this->user('caissier', $this->douala));

        $ids = collect($this->getJson('/api/expenses?per_page=50')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($own->id));
        $this->assertFalse($ids->contains($other->id));
        $this->assertFalse($ids->contains($administration->id));
    }

    public function test_an_agency_manager_cannot_see_administration_expenses(): void
    {
        $administration = $this->expense(null, Expense::STATUS_SUBMITTED);
        Sanctum::actingAs($this->user('responsable-agence', $this->douala));

        $this->getJson("/api/expenses/{$administration->id}")->assertNotFound();
        $this->postJson("/api/expenses/{$administration->id}/approve")->assertNotFound();
    }

    // --- Comptabilité : écritures directes ----------------------------------------

    public function test_an_agency_manager_cannot_enter_an_entry_for_another_agency(): void
    {
        Sanctum::actingAs($this->user('responsable-agence', $this->douala));

        $this->postJson('/api/accounting/transactions', [
            'type' => 'income',
            'label' => 'Recette',
            'amount' => 5000,
            'agency_id' => $this->yaounde->id,
            'treasury_account_id' => $this->account($this->yaounde, 'C')->id,
        ])->assertForbidden();

        $this->assertSame(0, AccountingTransaction::count());
    }

    public function test_an_agency_manager_cannot_touch_the_administration_cash_box(): void
    {
        Sanctum::actingAs($this->user('responsable-agence', $this->douala));

        // Ni sortie (circuit obligatoire), ni écriture sur la Caisse Administration (N11).
        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Frais',
            'amount' => 5000,
            'treasury_account_id' => $this->administrationCash()->id,
        ])->assertUnprocessable();
        $this->postJson('/api/accounting/transactions', [
            'type' => 'income',
            'label' => 'Recette',
            'amount' => 5000,
            'agency_id' => null,
            'treasury_account_id' => $this->administrationCash()->id,
        ])->assertForbidden();

        $this->assertSame(0, AccountingTransaction::count());
        $this->assertSame(0, $this->administrationCash()->transactions()->count());
    }

    public function test_an_agency_manager_entry_defaults_to_his_agency(): void
    {
        Sanctum::actingAs($this->user('responsable-agence', $this->douala));

        $id = $this->postJson('/api/accounting/transactions', [
            'type' => 'income',
            'label' => 'Recette',
            'amount' => 5000,
        ])->assertCreated()->json('id');

        $this->assertSame($this->douala->id, AccountingTransaction::find($id)->agency_id);
    }

    public function test_an_administration_entry_is_filed_under_its_country(): void
    {
        Sanctum::actingAs($this->user('comptable'));

        $id = $this->postJson('/api/accounting/transactions', [
            'type' => 'income',
            'label' => 'Apport',
            'amount' => 5000,
            'treasury_account_id' => $this->administrationCash()->id,
        ])->assertCreated()->json('id');

        $entry = AccountingTransaction::find($id);
        $this->assertNull($entry->agency_id);
        $this->assertSame($this->country->id, $entry->country_id);
    }

    public function test_an_agency_manager_cannot_correct_another_agency_entry(): void
    {
        $entry = AccountingTransaction::create([
            'number' => 1, 'agency_id' => $this->yaounde->id, 'type' => 'income', 'amount' => 5000,
            'label' => 'Recette Yaoundé', 'transacted_at' => now(),
        ]);
        Sanctum::actingAs($this->user('responsable-agence', $this->douala));

        $this->putJson("/api/accounting/transactions/{$entry->id}", ['amount' => 1])->assertForbidden();
        $this->deleteJson("/api/accounting/transactions/{$entry->id}")->assertForbidden();
        $this->assertEquals(5000, $entry->fresh()->amount);
    }

    // --- Outils ---------------------------------------------------------------------

    private function user(string $role, ?Agency $agency = null): User
    {
        $user = User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
        if ($agency) {
            DB::table('user_assignments')->insert([
                'user_id' => $user->id, 'agency_id' => $agency->id, 'is_primary' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $user;
    }

    private function account(Agency $agency, string $code): TreasuryAccount
    {
        return TreasuryAccount::where('agency_id', $agency->id)->where('code', $code)->firstOrFail();
    }

    private function administrationCash(): TreasuryAccount
    {
        return TreasuryAccount::whereNull('agency_id')->where('country_id', $this->country->id)->where('code', 'C')->firstOrFail();
    }

    private function expense(?Agency $agency, string $status): Expense
    {
        return Expense::create([
            'requested_by' => User::factory()->create()->id,
            'number' => sprintf('DEP-SCP-%03d', ++$this->sequence),
            'agency_id' => $agency?->id,
            'country_id' => $agency ? null : $this->country->id,
            'category_id' => $this->category->id,
            'amount' => 8000,
            'expense_date' => '2026-11-13',
            'status' => $status,
        ]);
    }
}
