<?php

namespace Tests\Feature;

use App\Mail\UserWelcomeMail;
use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Prospect;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Tout compte créé depuis l'interface d'administration (employé, client,
 * prospect converti) reçoit ses identifiants de connexion par email.
 * Le lien pointe vers le portail du rôle ; les comptes sans email réel
 * (placeholder pekegno.local) ne déclenchent aucun envoi ; un SMTP en
 * échec ne fait jamais échouer la création du compte.
 */
class WelcomeEmailServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_created_employee_receives_credentials_for_the_staff_portal(): void
    {
        Mail::fake();
        $this->actingAsRole('super-admin');

        $this->postJson('/api/users', [
            'username' => 'paul.nkoulou',
            'email' => 'paul.nkoulou@example.com',
            'first_name' => 'Paul',
            'last_name' => 'Nkoulou',
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ])->assertCreated();

        $employee = User::where('email', 'paul.nkoulou@example.com')->first();
        $this->assertNotNull($employee);

        // Le mot de passe transmis dans l'email fonctionne réellement.
        Mail::assertSent(UserWelcomeMail::class, function (UserWelcomeMail $mail) use ($employee) {
            return $mail->hasTo($employee->email)
                && Hash::check($mail->plainPassword, $employee->password)
                && $mail->loginUrl !== null
                && str_ends_with($mail->loginUrl, '/login');
        });
    }

    public function test_created_client_receives_credentials_for_the_client_portal(): void
    {
        Mail::fake();
        $this->actingAsRole('super-admin');

        $this->postJson('/api/clients', [
            'first_name' => 'Marie',
            'last_name' => 'Mballa',
            'email' => 'marie.mballa@example.com',
            'password' => 'MotDePasseFort1',
            'password_confirmation' => 'MotDePasseFort1',
        ])->assertCreated();

        $client = User::where('email', 'marie.mballa@example.com')->first();

        Mail::assertSent(UserWelcomeMail::class, function (UserWelcomeMail $mail) use ($client) {
            return $mail->hasTo($client->email)
                && Hash::check($mail->plainPassword, $client->password)
                && $mail->loginUrl !== null
                && str_ends_with($mail->loginUrl, '/connexion');
        });
    }

    public function test_client_without_real_email_receives_nothing(): void
    {
        Mail::fake();
        $this->actingAsRole('super-admin');

        // Apprenant inscrit au guichet sans email : identifiant placeholder généré.
        $this->postJson('/api/clients', [
            'first_name' => 'Apprenant',
            'last_name' => 'SansEmail',
        ])->assertCreated();

        Mail::assertNothingSent();
    }

    public function test_converted_prospect_with_email_receives_credentials(): void
    {
        Mail::fake();
        $this->actingAsRole('super-admin');

        Agency::create(['code' => 'WEL', 'name' => 'Agence Test', 'country' => 'Cameroun']);
        $commercial = Commercial::create(['first_name' => 'Paul', 'last_name' => 'Nkoulou']);
        $prospect = Prospect::create([
            'commercial_id' => $commercial->id,
            'first_name' => 'Jean',
            'last_name' => 'Converti',
            'email' => 'jean.converti@example.com',
        ]);

        $this->postJson("/api/prospects/{$prospect->id}/convert")->assertCreated();

        $client = User::where('email', 'jean.converti@example.com')->first();
        $this->assertNotNull($client);

        Mail::assertSent(UserWelcomeMail::class, function (UserWelcomeMail $mail) use ($client) {
            return $mail->hasTo($client->email)
                && Hash::check($mail->plainPassword, $client->password);
        });
    }

    public function test_converted_prospect_without_email_receives_nothing(): void
    {
        Mail::fake();
        $this->actingAsRole('super-admin');

        $commercial = Commercial::create(['first_name' => 'Paul', 'last_name' => 'Nkoulou']);
        $prospect = Prospect::create([
            'commercial_id' => $commercial->id,
            'first_name' => 'Jean',
            'last_name' => 'Anonyme',
        ]);

        $this->postJson("/api/prospects/{$prospect->id}/convert")->assertCreated();

        Mail::assertNothingSent();
    }

    public function test_smtp_failure_does_not_break_account_creation(): void
    {
        $this->actingAsRole('super-admin');

        // Mailer impossible à résoudre : l'envoi plante, la création doit passer.
        config(['mail.default' => 'mailer-inexistant']);

        $this->postJson('/api/clients', [
            'first_name' => 'Marie',
            'last_name' => 'Robuste',
            'email' => 'marie.robuste@example.com',
        ])->assertCreated();

        $this->assertDatabaseHas('users', ['email' => 'marie.robuste@example.com']);
    }
}
