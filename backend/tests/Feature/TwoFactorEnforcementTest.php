<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TwoFactorEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->markTestSkipped('Lot 9 désactivé le 11/11/2026 (décision Pekegno) — à réactiver plus tard.');
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        config(['security.enforce_two_factor' => true]);
    }

    private function user(string $role, array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', $role)->value('id'),
        ], $attributes));
    }

    public function test_sensitive_role_without_2fa_gets_a_restricted_session(): void
    {
        $cashier = $this->user('caissier');

        $response = $this->postJson('/api/auth/login', [
            'email' => $cashier->email,
            'password' => 'password',
        ])->assertOk()->assertJsonPath('two_factor_setup_required', true);

        $this->withToken($response->json('token'))
            ->getJson('/api/agencies')
            ->assertForbidden()
            ->assertJsonPath('code', 'TWO_FACTOR_SETUP_REQUIRED');

        $this->withToken($response->json('token'))
            ->getJson('/api/user')
            ->assertOk();
    }

    public function test_sensitive_role_with_2fa_logs_in_normally(): void
    {
        $accountant = $this->user('comptable', [
            'two_factor_enabled' => true,
            'two_factor_secret' => 'secret',
            'two_factor_channel' => 'totp',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $accountant->email,
            'password' => 'password',
        ])->assertOk()->assertJsonPath('two_factor_required', true);
    }

    public function test_other_roles_are_not_blocked(): void
    {
        $commercial = $this->user('commercial');

        $response = $this->postJson('/api/auth/login', [
            'email' => $commercial->email,
            'password' => 'password',
        ])->assertOk()->assertJsonMissingPath('two_factor_setup_required');

        $this->withToken($response->json('token'))
            ->getJson('/api/user')
            ->assertOk();
    }
}
