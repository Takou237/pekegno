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
 * T8.3 : création d'un client avec un nom ou un téléphone déjà présent.
 */
class ClientDuplicateWarningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Awa',
            'last_name' => 'Diop',
            'email' => 'awa.diop@example.test',
            'phone' => '+225 07 00 00 00 00',
        ], $overrides);
    }

    public function test_same_name_returns_409_with_suggestion(): void
    {
        $first = $this->postJson('/api/clients', $this->payload())->assertCreated()->json();

        $response = $this->postJson('/api/clients', $this->payload([
            'email' => 'awa.diop2@example.test',
            'phone' => '+225 07 11 11 11 11',
        ]));

        $response->assertStatus(409)
            ->assertJsonPath('duplicate', true)
            ->assertJsonPath('clients.0.id', $first['id']);
    }

    public function test_same_phone_with_another_name_returns_409(): void
    {
        $this->postJson('/api/clients', $this->payload())->assertCreated();

        $this->postJson('/api/clients', $this->payload([
            'first_name' => 'Fatou',
            'last_name' => 'Kone',
            'email' => 'fatou.kone@example.test',
        ]))->assertStatus(409)->assertJsonPath('duplicate', true);
    }

    public function test_allow_duplicate_confirms_the_creation(): void
    {
        $this->postJson('/api/clients', $this->payload())->assertCreated();

        $this->postJson('/api/clients', $this->payload([
            'email' => 'awa.diop2@example.test',
            'allow_duplicate' => true,
        ]))->assertCreated();
    }

    public function test_a_different_client_is_created_normally(): void
    {
        $this->postJson('/api/clients', $this->payload())->assertCreated();

        $this->postJson('/api/clients', $this->payload([
            'first_name' => 'Moussa',
            'last_name' => 'Traore',
            'email' => 'moussa.traore@example.test',
            'phone' => '+225 05 55 55 55 55',
        ]))->assertCreated();
    }
}
