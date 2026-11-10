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
 * B26 — 24 h d'inactivité, 12 h pour la direction générale.
 */
class SessionLifetimeByRoleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function user(string $role, int $inactiveMinutes): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
            'last_activity_at' => now()->subMinutes($inactiveMinutes),
        ]);
    }

    private function hitProtectedRoute(): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/stats/group?from=2026-11-01&to=2026-11-30');
    }

    public function test_direction_generale_keeps_a_twelve_hour_session(): void
    {
        Sanctum::actingAs($this->user('direction-generale', 11 * 60));

        $this->hitProtectedRoute()->assertOk();
    }

    public function test_direction_generale_expires_after_twelve_hours(): void
    {
        Sanctum::actingAs($this->user('direction-generale', 13 * 60));

        $this->hitProtectedRoute()->assertStatus(401);
    }

    public function test_other_roles_keep_their_session_for_a_day(): void
    {
        Sanctum::actingAs($this->user('commercial', 20 * 60));

        $this->hitProtectedRoute()->assertOk();
    }

    public function test_sessions_expire_after_twenty_four_hours(): void
    {
        Sanctum::actingAs($this->user('responsable-agence', 25 * 60));

        $this->hitProtectedRoute()->assertStatus(401);
    }
}
