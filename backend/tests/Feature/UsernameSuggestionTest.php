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
 * Ticket T15 : proposer un nom d'utilisateur libre dès la saisie du nom/prénom.
 */
class UsernameSuggestionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function actingAsRole(string $role): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
        ]));
    }

    public function test_suggests_normalized_first_and_last_name(): void
    {
        $this->actingAsRole('super-admin');

        $this->getJson('/api/users/username-suggestion?'.http_build_query(['first_name' => 'Jean-Marc Élé', 'last_name' => "N'Diaye"]))
            ->assertOk()
            ->assertJsonPath('username', 'jeanmarcele.ndiaye');
    }

    public function test_appends_a_number_when_username_is_taken(): void
    {
        $this->actingAsRole('super-admin');
        User::factory()->create(['username' => 'jean.dupont']);
        User::factory()->create(['username' => 'jean.dupont2']);

        $this->getJson('/api/users/username-suggestion?first_name=Jean&last_name=Dupont')
            ->assertOk()
            ->assertJsonPath('username', 'jean.dupont3');
    }

    public function test_returns_null_without_names_and_is_forbidden_to_other_roles(): void
    {
        $this->actingAsRole('super-admin');
        $this->getJson('/api/users/username-suggestion')->assertOk()->assertJsonPath('username', null);

        $this->actingAsRole('commercial');
        $this->getJson('/api/users/username-suggestion?first_name=Jean')->assertForbidden();
    }
}
