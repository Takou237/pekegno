<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Les emails aux clients sont coupés tant que CLIENT_EMAILS_ENABLED est faux.
 * Pas de Mail::fake() ici : il court-circuite l'événement MessageSending.
 */
class BlockClientEmailsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        config(['mail.default' => 'array']);
    }

    private function sentCount(): int
    {
        return Mail::mailer('array')->getSymfonyTransport()->messages()->count();
    }

    private function userWithRole(string $role, string $email): User
    {
        return User::factory()->create([
            'email' => $email,
            'role_id' => Role::where('name', $role)->value('id'),
        ]);
    }

    public function test_email_to_client_is_not_sent(): void
    {
        $this->userWithRole('client', 'Client@Example.com');

        Mail::raw('Bonjour', fn ($m) => $m->to('client@example.com')->subject('Test'));

        $this->assertSame(0, $this->sentCount());
    }

    public function test_email_to_staff_is_still_sent(): void
    {
        $this->userWithRole('caissier', 'caissier@example.com');

        Mail::raw('Bonjour', fn ($m) => $m->to('caissier@example.com')->subject('Test'));

        $this->assertSame(1, $this->sentCount());
    }

    public function test_client_email_is_sent_when_flag_enabled(): void
    {
        config(['mail.client_emails_enabled' => true]);
        $this->userWithRole('client', 'client@example.com');

        Mail::raw('Bonjour', fn ($m) => $m->to('client@example.com')->subject('Test'));

        $this->assertSame(1, $this->sentCount());
    }
}
