<?php

namespace Tests\Feature;

use App\Mail\TwoFactorCodeMail;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * 2FA par email sur le portail client : le défi partagé /auth/2fa/login ne
 * doit pas imposer de session unique aux clients (pas d'active_session_id),
 * et le client doit pouvoir auto-activer la 2FA depuis /client/2fa/*.
 */
class TwoFactorClientPortalTest extends TestCase
{
    use RefreshDatabase;

    private function client(array $attributes = []): User
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', 'client')->value('id'),
        ], $attributes));
    }

    /** Le middleware portal:client exige un token nommé client-token. */
    private function actingAsClient(User $user): void
    {
        $token = $user->createToken('client-token')->plainTextToken;
        $this->withHeader('Authorization', "Bearer {$token}");
    }

    public function test_client_login_with_email_2fa_sends_code_and_completes_without_single_session(): void
    {
        Mail::fake();

        $user = $this->client([
            'two_factor_enabled' => true,
            'two_factor_secret' => 'marker',
            'two_factor_channel' => 'email',
        ]);

        $login = $this->postJson('/api/client/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        // Le défi est renvoyé tel quel (pas de crash UserResource sur null).
        $login->assertOk()
            ->assertJsonPath('two_factor_required', true)
            ->assertJsonPath('two_factor_channel', 'email')
            ->assertJsonMissing(['user' => null]);

        Mail::assertSent(TwoFactorCodeMail::class, 1);
        $code = Mail::sent(TwoFactorCodeMail::class)->first()->code;

        $response = $this->postJson('/api/auth/2fa/login', [
            'temp_token' => $login->json('temp_token'),
            'code' => $code,
        ]);

        $response->assertOk()->assertJsonStructure(['token', 'user']);

        // Un client n'a pas de session unique : active_session_id doit rester null.
        $this->assertNull($user->fresh()->active_session_id);
    }

    public function test_client_can_self_enable_email_2fa_from_profile(): void
    {
        Mail::fake();

        $user = $this->client();
        $this->actingAsClient($user);

        // Les clients sont forcés sur le canal email, même sans paramètre.
        $enable = $this->postJson('/api/client/2fa/enable');

        $enable->assertOk()
            ->assertJsonPath('channel', 'email')
            ->assertJsonStructure(['masked_email']);

        $this->assertEquals('email', $user->fresh()->two_factor_channel);

        $code = Mail::sent(TwoFactorCodeMail::class)->first()->code;

        $this->postJson('/api/client/2fa/verify', ['code' => $code])->assertOk();

        $user->refresh();
        $this->assertTrue((bool) $user->two_factor_enabled);
        $this->assertEquals('email', $user->two_factor_channel);
    }

    public function test_client_can_disable_with_password_and_code(): void
    {
        Mail::fake();

        $user = $this->client([
            'two_factor_enabled' => true,
            'two_factor_secret' => 'marker',
            'two_factor_channel' => 'email',
        ]);
        $this->actingAsClient($user);

        $this->postJson('/api/client/2fa/email/send')->assertOk();

        $code = Mail::sent(TwoFactorCodeMail::class)->first()->code;

        $this->postJson('/api/client/2fa/disable', [
            'password' => 'password',
            'code' => $code,
        ])->assertOk();

        $user->refresh();
        $this->assertFalse((bool) $user->two_factor_enabled);
        $this->assertNull($user->two_factor_secret);
    }

    public function test_client_login_without_2fa_returns_user_directly(): void
    {
        Mail::fake();

        $user = $this->client();

        $response = $this->postJson('/api/client/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user'])
            ->assertJsonMissing(['two_factor_required']);

        Mail::assertNothingSent();
    }
}
