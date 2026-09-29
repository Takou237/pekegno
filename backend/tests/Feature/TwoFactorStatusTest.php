<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Services\TwoFactorService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Régression : après activation, le profil affichait toujours « 2FA non
 * activée » car GET /api/user ne renvoyait pas two_factor_enabled.
 */
class TwoFactorStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_reports_two_factor_status_after_activation(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $user = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
        Sanctum::actingAs($user);

        $this->getJson('/api/user')->assertOk()->assertJsonPath('two_factor_enabled', false);

        // Code TOTP accepté : on ne teste ici que le statut renvoyé par l'API.
        $this->partialMock(TwoFactorService::class, fn ($mock) => $mock->shouldReceive('verifyKey')->andReturn(true));

        $this->postJson('/api/auth/2fa/enable')->assertOk();
        $this->postJson('/api/auth/2fa/verify', ['code' => '123456'])->assertOk();

        $this->getJson('/api/user')->assertOk()->assertJsonPath('two_factor_enabled', true);
    }
}
