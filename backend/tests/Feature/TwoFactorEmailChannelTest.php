<?php

namespace Tests\Feature;

use App\Mail\TwoFactorCodeMail;
use App\Models\Role;
use App\Models\User;
use App\Services\TwoFactorService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Hashing\Hasher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TwoFactorEmailChannelTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(array $attributes = []): User
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ], $attributes));
    }

    public function test_email_activation_sends_code_and_enables_after_verify(): void
    {
        Mail::fake();
        $user = $this->superAdmin();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/auth/2fa/enable', ['channel' => 'email']);

        $response->assertOk()
            ->assertJsonPath('channel', 'email')
            ->assertJsonStructure(['masked_email']);

        // L'email ne contient jamais l'email complet en clair dans la réponse…
        $this->assertStringNotContainsString($user->email, $response->json('masked_email'));
        // …mais un code est bien parti vers la vraie adresse.
        Mail::assertSent(TwoFactorCodeMail::class, 1);

        $code = Cache::get('2fa_email_code:'.$user->id);

        // L'ancien flux TOTP (enable sans channel) continue de fonctionner.
        $this->assertNotNull($code);
        $this->assertEquals('email', $user->fresh()->two_factor_channel);
        $this->assertFalse((bool) $user->fresh()->two_factor_enabled);

        // Le code du mail doit être celui stocké (hashé) en cache.
        $mail = Mail::sent(TwoFactorCodeMail::class)->first();
        $this->assertNotNull($mail);

        // On récupère le code en clair depuis la fake : le mailable l'expose.
        $plainCode = $mail->code;

        // Le code stocké est bien un hash du code envoyé.
        $this->assertTrue(app(Hasher::class)->check($plainCode, $code['hash']));

        $this->postJson('/api/auth/2fa/verify', ['code' => $plainCode])->assertOk();

        $user->refresh();
        $this->assertTrue((bool) $user->two_factor_enabled);
        $this->assertEquals('email', $user->two_factor_channel);
    }

    public function test_login_with_email_channel_sends_code_and_completes_signin(): void
    {
        Mail::fake();

        $user = $this->superAdmin([
            'two_factor_enabled' => true,
            'two_factor_secret' => Crypt::encrypt('JBSWY3DPEHPK3PXP'),
            'two_factor_channel' => 'email',
        ]);

        $login = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $login->assertOk()
            ->assertJsonPath('two_factor_required', true)
            ->assertJsonPath('two_factor_channel', 'email');

        Mail::assertSent(TwoFactorCodeMail::class, 1);
        $plainCode = Mail::sent(TwoFactorCodeMail::class)->first()->code;

        $tempToken = $login->json('temp_token');

        // Mauvais code : rejeté, token conservé pour retenter.
        $this->postJson('/api/auth/2fa/login', [
            'temp_token' => $tempToken,
            'code' => '000000',
        ])->assertStatus(422);

        // Le code du mail (vérifié via la fake) est accepté et consomme le défi.
        $this->postJson('/api/auth/2fa/login', [
            'temp_token' => $tempToken,
            'code' => $plainCode,
        ])->assertOk()->assertJsonStructure(['token', 'user']);
    }

    public function test_resend_endpoint_is_throttled_and_delivers_new_code(): void
    {
        Mail::fake();

        $user = $this->superAdmin([
            'two_factor_enabled' => true,
            'two_factor_secret' => Crypt::encrypt('JBSWY3DPEHPK3PXP'),
            'two_factor_channel' => 'email',
        ]);

        $login = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $tempToken = $login->json('temp_token');

        // Cooldown actif juste après l'envoi du login : refusé.
        $this->postJson('/api/auth/2fa/email/resend', ['temp_token' => $tempToken])
            ->assertStatus(429)
            ->assertJsonStructure(['retry_after']);

        // On simule l'écoulement du délai.
        $this->travel(61)->seconds();

        $this->postJson('/api/auth/2fa/email/resend', ['temp_token' => $tempToken])
            ->assertOk();

        Mail::assertSent(TwoFactorCodeMail::class, 2);

        // Le nouveau code remplace l'ancien : le premier n'est plus valable.
        $newCode = Mail::sent(TwoFactorCodeMail::class)->last()->code;
        $oldCode = Mail::sent(TwoFactorCodeMail::class)->first()->code;

        $this->postJson('/api/auth/2fa/login', [
            'temp_token' => $tempToken,
            'code' => $oldCode,
        ])->assertStatus(422);

        $this->postJson('/api/auth/2fa/login', [
            'temp_token' => $tempToken,
            'code' => $newCode,
        ])->assertOk();
    }

    public function test_resend_rejects_totp_users(): void
    {
        Mail::fake();

        $user = $this->superAdmin([
            'two_factor_enabled' => true,
            'two_factor_secret' => Crypt::encrypt('JBSWY3DPEHPK3PXP'),
            'two_factor_channel' => 'totp',
        ]);

        $login = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $this->postJson('/api/auth/2fa/email/resend', [
            'temp_token' => $login->json('temp_token'),
        ])->assertStatus(422);

        Mail::assertNothingSent();
    }

    public function test_disable_works_with_email_code(): void
    {
        Mail::fake();
        $user = $this->superAdmin([
            'two_factor_enabled' => true,
            'two_factor_secret' => Crypt::encrypt('JBSWY3DPEHPK3PXP'),
            'two_factor_channel' => 'email',
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/auth/2fa/email/send')->assertOk();

        $code = Mail::sent(TwoFactorCodeMail::class)->first()->code;

        $this->postJson('/api/auth/2fa/disable', [
            'password' => 'password',
            'code' => $code,
        ])->assertOk();

        $user->refresh();
        $this->assertFalse((bool) $user->two_factor_enabled);
        $this->assertNull($user->two_factor_secret);
        $this->assertEquals('totp', $user->two_factor_channel);
    }

    public function test_email_code_is_consumed_after_successful_use(): void
    {
        Mail::fake();
        $user = $this->superAdmin([
            'two_factor_enabled' => true,
            'two_factor_secret' => Crypt::encrypt('JBSWY3DPEHPK3PXP'),
            'two_factor_channel' => 'email',
        ]);

        $login = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $code = Mail::sent(TwoFactorCodeMail::class)->first()->code;
        $tempToken = $login->json('temp_token');

        $this->postJson('/api/auth/2fa/login', [
            'temp_token' => $tempToken,
            'code' => $code,
        ])->assertOk();

        // Reconnexion : un NOUVEAU code est nécessaire, l'ancien ne marche plus.
        $login2 = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $this->postJson('/api/auth/2fa/login', [
            'temp_token' => $login2->json('temp_token'),
            'code' => $code,
        ])->assertStatus(422);
    }

    public function test_legacy_totp_flow_still_works(): void
    {
        Mail::fake();
        $user = $this->superAdmin();
        Sanctum::actingAs($user);

        // Enable sans channel = TOTP, aucun email ne doit partir.
        $enable = $this->postJson('/api/auth/2fa/enable')->assertOk();

        $this->assertEquals('totp', $enable->json('channel'));
        $this->assertStringStartsWith('otpauth://totp/', $enable->json('qr_code_url'));
        Mail::assertNothingSent();

        $secret = $enable->json('secret');
        $service = app(TwoFactorService::class);

        // Génère un code TOTP valide pour la fenêtre courante.
        $method = new \ReflectionMethod($service, 'generateTotp');
        $method->setAccessible(true);
        $code = $method->invoke($service, $secret, floor(time() / 30));

        $this->postJson('/api/auth/2fa/verify', ['code' => $code])->assertOk();
        $this->assertTrue((bool) $user->fresh()->two_factor_enabled);
        $this->assertEquals('totp', $user->fresh()->two_factor_channel);

        // Connexion complète en TOTP : aucun email.
        $login = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->assertJsonPath('two_factor_channel', 'totp');

        Mail::assertNothingSent();

        $this->postJson('/api/auth/2fa/login', [
            'temp_token' => $login->json('temp_token'),
            'code' => $code,
        ])->assertOk();
    }
}
