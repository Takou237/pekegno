<?php

namespace Tests\Feature;

use App\Mail\AdminPasswordResetMail;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Réinitialisation du mot de passe d'un utilisateur par un administrateur.
 *
 * L'administrateur ne choisit pas le mot de passe : un mot de passe provisoire
 * est généré puis envoyé par email à l'utilisateur concerné.
 */
class AdminPasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
        ]);
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function employee(): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
            'password' => Hash::make('ancienMotDePasse'),
        ]);
    }

    public function test_super_admin_resets_the_password_and_sends_the_new_one_by_email(): void
    {
        Mail::fake();
        $this->actingAsRole('super-admin');
        $employee = $this->employee();

        $this->postJson("/api/users/{$employee->id}/reset-password")
            ->assertOk()
            ->assertJsonPath('message', 'Mot de passe réinitialisé. Un email avec les nouveaux accès a été envoyé à l\'utilisateur.');

        $employee->refresh();

        $this->assertFalse(Hash::check('ancienMotDePasse', $employee->password));
        $this->assertTrue($employee->is_password_change_required);

        Mail::assertSent(AdminPasswordResetMail::class, function (AdminPasswordResetMail $mail) use ($employee) {
            return $mail->hasTo($employee->email)
                && $mail->user->id === $employee->id
                && strlen($mail->plainPassword) >= 12
                && Hash::check($mail->plainPassword, $employee->fresh()->password)
                && $mail->loginUrl !== null
                && str_ends_with($mail->loginUrl, '/login');
        });
    }

    public function test_each_reset_generates_a_different_password(): void
    {
        Mail::fake();
        $this->actingAsRole('super-admin');
        $employee = $this->employee();

        $this->postJson("/api/users/{$employee->id}/reset-password")->assertOk();
        $first = $employee->fresh()->password;

        $this->postJson("/api/users/{$employee->id}/reset-password")->assertOk();

        $this->assertNotSame($first, $employee->fresh()->password);
        Mail::assertSent(AdminPasswordResetMail::class, 2);
    }

    public function test_pending_reset_tokens_and_sessions_are_revoked(): void
    {
        Mail::fake();
        $this->actingAsRole('super-admin');
        $employee = $this->employee();
        $employee->tokens()->create([
            'name' => 'session-mobile',
            'token' => hash('sha256', 'jeton-de-session'),
        ]);
        DB::table('password_reset_tokens')->insert([
            'email' => $employee->email,
            'token' => 'token-en-attente',
            'created_at' => now(),
        ]);

        $this->postJson("/api/users/{$employee->id}/reset-password")->assertOk();

        $this->assertSame(0, $employee->tokens()->count());
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $employee->email]);
    }

    public function test_reset_is_logged_in_the_activity_log(): void
    {
        Mail::fake();
        $this->actingAsRole('super-admin');
        $employee = $this->employee();

        $this->postJson("/api/users/{$employee->id}/reset-password")->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'entity_type' => 'user',
            'entity_id' => $employee->id,
            'action' => 'password_reset',
        ]);
    }

    public function test_direction_generale_can_reset_an_employee(): void
    {
        Mail::fake();
        $this->actingAsRole('direction-generale');
        $employee = $this->employee();

        $this->postJson("/api/users/{$employee->id}/reset-password")->assertOk();

        Mail::assertSent(AdminPasswordResetMail::class, 1);
    }

    public function test_direction_generale_cannot_reset_a_super_admin_password(): void
    {
        Mail::fake();
        $this->actingAsRole('direction-generale');
        $superAdmin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
            'password' => Hash::make('ancienMotDePasse'),
        ]);

        $this->postJson("/api/users/{$superAdmin->id}/reset-password")->assertForbidden();

        $this->assertTrue(Hash::check('ancienMotDePasse', $superAdmin->fresh()->password));
        Mail::assertNothingSent();
    }

    public function test_agency_manager_cannot_reset_a_password(): void
    {
        Mail::fake();
        $this->actingAsRole('responsable-agence');
        $employee = $this->employee();

        $this->postJson("/api/users/{$employee->id}/reset-password")->assertForbidden();

        $this->assertTrue(Hash::check('ancienMotDePasse', $employee->fresh()->password));
        Mail::assertNothingSent();
    }
}
