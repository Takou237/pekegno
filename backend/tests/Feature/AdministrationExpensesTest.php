<?php

namespace Tests\Feature;

use App\Models\AccountingCategory;
use App\Models\Agency;
use App\Models\Country;
use App\Models\Expense;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Cahier §2 — dépenses de l'Administration d'un pays (sans agence). */
class AdministrationExpensesTest extends TestCase
{
    use RefreshDatabase;

    private int $sequence = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    public function test_comptable_creates_an_expense_for_the_administration_of_a_country(): void
    {
        $country = $this->country('CMR');
        $comptable = $this->user('comptable', $country);
        Sanctum::actingAs($comptable);

        $data = $this->postJson('/api/expenses', [
            'country_id' => $country->id,
            'category_id' => $this->category()->id,
            'amount' => 12500,
            'expense_date' => '2026-11-13',
            'note' => 'Publicité Pekegno',
        ])->assertCreated()->json();

        $this->assertNull($data['agency_id']);
        $this->assertSame($country->id, $data['country_id']);
        $this->assertSame($country->name, $data['country']['name']);
    }

    public function test_an_agency_manager_cannot_create_an_administration_expense(): void
    {
        $country = $this->country('CMR');
        Agency::factory()->create(['country_id' => $country->id]);
        Sanctum::actingAs($this->user('responsable-agence', $country));

        $this->postJson('/api/expenses', [
            'country_id' => $country->id,
            'category_id' => $this->category()->id,
            'amount' => 1000,
            'expense_date' => '2026-11-13',
        ])->assertForbidden();
    }

    public function test_a_country_director_sees_the_administration_expenses_of_their_country(): void
    {
        $cameroun = $this->country('CMR');
        $gabon = $this->country('GAB');
        $ownAgency = Agency::factory()->create(['country_id' => $cameroun->id]);
        Agency::factory()->create(['country_id' => $gabon->id]);

        $admin = $this->user('super-admin');
        $category = $this->category();
        $ownAgencyExpense = $this->expense($admin, $category, $cameroun, $ownAgency);
        $ownAdminExpense = $this->expense($admin, $category, $cameroun);
        $otherAdminExpense = $this->expense($admin, $category, $gabon);

        Sanctum::actingAs($this->user('direction-generale', $cameroun));

        $ids = collect($this->getJson('/api/expenses?per_page=50')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($ownAgencyExpense->id));
        $this->assertTrue($ids->contains($ownAdminExpense->id));
        $this->assertFalse($ids->contains($otherAdminExpense->id));

        $adminOnly = collect($this->getJson('/api/expenses?administration=1&per_page=50')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($adminOnly->contains($ownAdminExpense->id));
        $this->assertFalse($adminOnly->contains($ownAgencyExpense->id));
        $this->assertFalse($adminOnly->contains($otherAdminExpense->id));
    }

    public function test_a_country_director_attaches_a_receipt_to_an_administration_expense_of_their_country(): void
    {
        Storage::fake('public');
        $cameroun = $this->country('CMR');
        $gabon = $this->country('GAB');

        $admin = $this->user('super-admin');
        $category = $this->category();
        $own = $this->expense($admin, $category, $cameroun);
        $other = $this->expense($admin, $category, $gabon);

        Sanctum::actingAs($this->user('direction-generale', $cameroun));

        $this->post("/api/expenses/{$own->id}/justification", ['file' => $this->png('recu-1.png')], ['Accept' => 'application/json'])->assertOk();
        $this->post("/api/expenses/{$other->id}/justification", ['file' => $this->png('recu-2.png')], ['Accept' => 'application/json'])->assertNotFound();
    }

    private function country(string $code): Country
    {
        return Country::create([
            'name' => "Pays {$code}",
            'code' => $code,
            'currency_code' => 'XAF',
            'exchange_rate' => 1,
            'is_active' => true,
        ]);
    }

    private function user(string $role, ?Country $country = null): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
            'country_id' => $country?->id,
        ]);
    }

    private function category(): AccountingCategory
    {
        return AccountingCategory::create(['name' => 'Frais administration', 'type' => 'expense']);
    }

    private function expense(User $requester, AccountingCategory $category, ?Country $country, ?Agency $agency = null): Expense
    {
        return Expense::create([
            'requested_by' => $requester->id,
            'number' => sprintf('DEP-ADM-%03d', ++$this->sequence),
            'agency_id' => $agency?->id,
            'country_id' => $country?->id,
            'category_id' => $category->id,
            'amount' => 5000,
            'expense_date' => '2026-11-13',
            'status' => Expense::STATUS_DRAFT,
        ]);
    }

    private function png(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            $name,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=')
        );
    }
}
