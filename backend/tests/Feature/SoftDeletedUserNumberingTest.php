<?php

namespace Tests\Feature;

use App\Models\AccountingCategory;
use App\Models\Agency;
use App\Models\Expense;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Prod 07/11 : « Server Error » à la création d'un client. Le dernier numéro
 * (CL-00212) appartenait à un client supprimé (suppression logique) ; il était
 * ignoré, donc recalculé, et la contrainte d'unicité faisait échouer l'insertion.
 */
class SoftDeletedUserNumberingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
    }

    private function createClient(string $email): array
    {
        return $this->postJson('/api/clients', [
            'first_name' => 'Client',
            'last_name' => 'Test',
            'email' => $email,
            'password' => 'password',
            'password_confirmation' => 'password',
            'allow_duplicate' => true,
        ])->assertCreated()->json();
    }

    public function test_client_number_skips_numbers_of_deleted_clients(): void
    {
        $first = $this->createClient('premier@example.com');
        $second = $this->createClient('second@example.com');
        $this->assertSame('CL-00002', User::find($second['id'])->client_number);

        // Le client qui porte le dernier numéro est supprimé.
        User::find($second['id'])->softDeleteClient();

        $third = $this->createClient('troisieme@example.com');

        $this->assertSame('CL-00001', User::find($first['id'])->client_number);
        $this->assertSame('CL-00003', User::find($third['id'])->client_number);
    }

    public function test_username_suggestion_skips_usernames_of_deleted_accounts(): void
    {
        User::factory()->create(['username' => 'jean.dupont'])->delete();

        $this->getJson('/api/users/username-suggestion?first_name=Jean&last_name=Dupont')
            ->assertOk()
            ->assertJsonPath('username', 'jean.dupont2');
    }

    public function test_expense_number_skips_numbers_of_deleted_expenses(): void
    {
        $agency = Agency::factory()->create();
        $category = AccountingCategory::create(['name' => 'Fournitures', 'type' => 'expense']);
        $requester = User::factory()->create();
        $make = fn (string $number) => Expense::create([
            'number' => $number, 'agency_id' => $agency->id, 'category_id' => $category->id, 'amount' => 1000,
            'expense_date' => '2026-11-07', 'status' => 'pending', 'requested_by' => $requester->id,
        ]);
        $make('EXP-00001');
        $make('EXP-00002')->delete(); // la dernière dépense est supprimée

        $this->assertSame('EXP-00003', Expense::generateNextNumber());
    }

    public function test_deleted_client_frees_its_email_for_a_new_account(): void
    {
        $client = $this->createClient('reviens@example.com');

        $this->deleteJson("/api/clients/{$client['id']}")->assertSuccessful();

        $again = $this->createClient('reviens@example.com');
        $this->assertNotSame($client['id'], $again['id']);
        $this->assertSame('CL-00002', User::find($again['id'])->client_number);
        $this->assertSame('CL-00001', User::withTrashed()->find($client['id'])->client_number);
    }

    public function test_deleted_employee_frees_email_and_username(): void
    {
        $role = Role::where('name', 'commercial')->value('id');
        $payload = [
            'username' => 'awa.diallo', 'email' => 'awa@example.com', 'first_name' => 'Awa', 'last_name' => 'Diallo',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!', 'role_id' => $role,
        ];
        $id = $this->postJson('/api/users', $payload)->assertCreated()->json('id') ?? User::where('email', 'awa@example.com')->value('id');

        $this->deleteJson("/api/users/{$id}")->assertSuccessful();
        $this->assertSoftDeleted('users', ['id' => $id]);

        $this->postJson('/api/users', $payload)->assertCreated();
    }

    public function test_client_deleting_own_account_can_register_again(): void
    {
        $client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
            'email' => 'moi@example.com', 'username' => 'moi@example.com', 'password' => 'password',
        ]);
        Sanctum::actingAs($client);

        $this->deleteJson('/api/auth/account', ['password' => 'password'])->assertOk();

        $this->assertSame(0, User::where('email', 'moi@example.com')->count());
        $this->assertNotSame('moi@example.com', User::withTrashed()->find($client->id)->email);
    }
}
