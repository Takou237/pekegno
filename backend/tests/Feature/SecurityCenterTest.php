<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SecurityCenterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->markTestSkipped('Lot 9 désactivé le 11/11/2026 (décision Pekegno) — à réactiver plus tard.');
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function user(string $role): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
        ]);
    }

    public function test_super_admin_sees_the_security_center(): void
    {
        $superAdmin = $this->user('super-admin');
        $cashier = $this->user('caissier');
        $cashier->createToken('staff-token');

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/security/center')
            ->assertOk()
            ->assertJsonStructure([
                'environment' => ['app_env', 'debug', 'staging'],
                'sessions',
                'privileged_accounts',
                'developer_access',
                'recent_events',
                'alerts',
            ])
            ->assertJsonPath('sessions.0.user.role', 'caissier');
    }

    public function test_non_super_admin_is_forbidden(): void
    {
        Sanctum::actingAs($this->user('responsable-agence'));

        $this->getJson('/api/security/center')->assertForbidden();
    }
}
