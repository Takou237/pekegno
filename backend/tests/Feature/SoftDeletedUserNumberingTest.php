<?php

namespace Tests\Feature;

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
}
