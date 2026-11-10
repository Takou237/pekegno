<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityAuditAccountsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function user(string $role, array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', $role)->value('id'),
        ], $attributes));
    }

    public function test_generic_accounts_are_reported_and_can_be_deactivated(): void
    {
        $generic = $this->user('caissier', [
            'first_name' => 'Caissier',
            'last_name' => 'Provisoire',
            'email' => 'caissier.provisoire@example.test',
        ]);
        $normal = $this->user('comptable', [
            'first_name' => 'Awa',
            'last_name' => 'Diop',
            'email' => 'awa.diop@example.test',
        ]);

        $this->artisan('security:audit-accounts')->assertExitCode(1);
        $this->assertTrue($generic->fresh()->is_active);

        $this->artisan('security:audit-accounts', ['--fix' => true])->assertExitCode(1);

        $this->assertFalse($generic->fresh()->is_active);
        $this->assertTrue($normal->fresh()->is_active);
    }

    public function test_a_clean_staff_is_reported_as_clean(): void
    {
        $this->user('comptable', [
            'first_name' => 'Awa',
            'last_name' => 'Diop',
            'email' => 'awa.diop@example.test',
            'two_factor_enabled' => true,
            'two_factor_secret' => 'secret',
        ]);

        $this->artisan('security:audit-accounts')->assertExitCode(0);
    }
}
