<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Country;
use App\Models\Department;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Chef d'agence, chef de département et directeur général peuvent vendre /
 * créer des factures, y compris pour une agence hors de leur périmètre :
 * les rôles autorisés à vendre ne sont pas limités par le périmètre
 * organisationnel. La facture est rattachée à l'agence choisie.
 */
class ManagerSalesTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private Agency $otherAgency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $country = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF', 'is_active' => true]);
        $other = Country::create(['name' => "Côte d'Ivoire", 'code' => 'CIV', 'currency_code' => 'XOF', 'is_active' => true]);
        $this->agency = Agency::factory()->create(['country_id' => $country->id]);
        $this->otherAgency = Agency::factory()->create(['country_id' => $other->id]);
    }

    private function user(string $role, array $extra = []): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')] + $extra);
    }

    private function sell(Agency $agency): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/invoices', [
            'agency_id' => $agency->id,
            'client_id' => $this->user('client')->id,
            'payment_type' => 'cash',
            'advance' => 5000,
            'items' => [['label' => 'Vente', 'unit_price' => 5000, 'quantity' => 1]],
        ]);
    }

    public function test_agency_chief_sells_in_own_agency_with_pending_validation(): void
    {
        $chief = $this->user('responsable-agence');
        $chief->assignments()->sync([$this->agency->id => ['is_primary' => true]]);
        Sanctum::actingAs($chief);

        $id = $this->sell($this->agency)->assertCreated()->json('id');
        $this->assertSame(Invoice::VALIDATION_PENDING, Invoice::findOrFail($id)->validation_status, 'Validée ensuite par le caissier ou le DG.');
    }

    public function test_agency_chief_can_sell_in_another_agency(): void
    {
        $chief = $this->user('responsable-agence');
        $chief->assignments()->sync([$this->agency->id => ['is_primary' => true]]);
        Sanctum::actingAs($chief);

        $id = $this->sell($this->otherAgency)->assertCreated()->json('id');

        $this->assertSame(
            $this->otherAgency->id,
            Invoice::findOrFail($id)->agency_id,
            'La facture est rattachée à l\'agence du produit, pas à celle du vendeur.'
        );
    }

    public function test_department_chief_can_sell_in_another_agency(): void
    {
        $department = Department::factory()->create(['agency_id' => $this->agency->id]);
        $chief = $this->user('responsable-departement');
        $chief->assignments()->sync([$this->agency->id => ['is_department_chief' => true, 'department_id' => $department->id]]);

        \DB::table('department_chiefs')->insert(['id' => (string) Str::uuid(), 'user_id' => $chief->id, 'department_id' => $department->id]);
        Sanctum::actingAs($chief);

        $id = $this->sell($this->otherAgency)->assertCreated()->json('id');

        $this->assertSame($this->otherAgency->id, Invoice::findOrFail($id)->agency_id);
    }

    public function test_director_sells_in_own_country_and_sale_is_validated_directly(): void
    {
        $director = $this->user('direction-generale', ['country_id' => $this->agency->country_id]);
        Sanctum::actingAs($director);

        $id = $this->sell($this->agency)->assertCreated()->json('id');
        $invoice = Invoice::findOrFail($id);
        $this->assertSame(Invoice::VALIDATION_VALIDATED, $invoice->validation_status);
        $this->assertSame(5000.0, (float) $invoice->amount_paid, 'L\'avance est encaissée tout de suite.');

        // Le directeur peut aussi facturer une agence d'un autre pays.
        $this->sell($this->otherAgency)->assertCreated();
    }
}
