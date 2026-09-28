<?php

namespace Tests\Feature;

use App\Mail\UserWelcomeMail;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

/**
 * Email de création d'utilisateur.
 *
 * À la création d'un compte, l'administrateur ne saisit pas de mot de passe :
 * le nouvel utilisateur doit recevoir ses paramètres de connexion par email
 * (identifiant, nom d'utilisateur et mot de passe par défaut).
 */
class UserWelcomeMailTest extends TestCase
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

    private function superAdmin(): User
    {
        $admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'username' => 'nouvel.employe',
            'email' => 'nouvel.employe@pekegno.test',
            'first_name' => 'Nouvel',
            'last_name' => 'Employé',
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ], $overrides);
    }

    public function test_creation_sends_login_details_with_default_password(): void
    {
        Mail::fake();
        $this->superAdmin();

        $this->postJson('/api/users', $this->payload())
            ->assertCreated()
            ->assertJsonPath('email', 'nouvel.employe@pekegno.test');

        Mail::assertSent(UserWelcomeMail::class, function (UserWelcomeMail $mail) {
            return $mail->hasTo('nouvel.employe@pekegno.test')
                && $mail->user->username === 'nouvel.employe'
                && $mail->user->first_name === 'Nouvel'
                && $mail->plainPassword === 'password'
                && $mail->loginUrl !== null
                && str_ends_with($mail->loginUrl, '/login');
        });
    }

    public function test_default_password_is_usable_to_authenticate(): void
    {
        Mail::fake();
        $this->superAdmin();

        $this->postJson('/api/users', $this->payload())->assertCreated();

        $created = User::where('email', 'nouvel.employe@pekegno.test')->firstOrFail();

        $this->assertTrue(Hash::check('password', $created->password));
    }

    public function test_creation_sends_the_password_chosen_by_the_administrator(): void
    {
        Mail::fake();
        $this->superAdmin();

        $this->postJson('/api/users', $this->payload([
            'password' => 'MotDePasse2026',
            'password_confirmation' => 'MotDePasse2026',
        ]))->assertCreated();

        Mail::assertSent(UserWelcomeMail::class, function (UserWelcomeMail $mail) {
            return $mail->plainPassword === 'MotDePasse2026';
        });
    }

    public function test_user_is_created_even_when_the_email_cannot_be_sent(): void
    {
        Log::spy();
        Mail::shouldReceive('to')->andThrow(new RuntimeException('Serveur SMTP injoignable'));
        $this->superAdmin();

        $this->postJson('/api/users', $this->payload())
            ->assertCreated()
            ->assertJsonPath('username', 'nouvel.employe');

        $this->assertDatabaseHas('users', ['email' => 'nouvel.employe@pekegno.test']);
        Log::shouldHaveReceived('error')->once();
    }

    public function test_welcome_email_displays_the_login_details(): void
    {
        $user = User::factory()->create([
            'username' => 'nouvel.employe',
            'email' => 'nouvel.employe@pekegno.test',
            'first_name' => 'Nouvel',
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        $rendered = (new UserWelcomeMail(
            user: $user,
            plainPassword: 'password',
            loginUrl: 'http://localhost:5173/login',
        ))->render();

        $this->assertStringContainsString('nouvel.employe@pekegno.test', $rendered);
        $this->assertStringContainsString('nouvel.employe', $rendered);
        $this->assertStringContainsString('http://localhost:5173/login', $rendered);
        $this->assertStringContainsString('commercial', $rendered);
    }
}
