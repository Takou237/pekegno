<?php

namespace Tests\Feature;

use App\Mail\PendingInvoiceMail;
use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Country;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Une vente d'un commercial part en attente de validation : les caissiers
 * concernés en sont prévenus par email.
 */
class PendingInvoiceNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Mail::fake();
        Storage::fake('public');
    }

    private function cashier(string $email, ?Agency $agency): User
    {
        $user = User::factory()->create([
            'email' => $email,
            'role_id' => Role::where('name', 'caissier')->value('id'),
            'is_active' => true,
        ]);
        if ($agency) {
            DB::table('user_assignments')->insert([
                'user_id' => $user->id,
                'agency_id' => $agency->id,
                'is_primary' => false,
                'is_department_chief' => false,
            ]);
        }

        return $user;
    }

    private function sellAs(User $user, Agency $agency): void
    {
        Sanctum::actingAs($user);
        $this->post('/api/invoices', [
            'agency_id' => $agency->id,
            'items' => [['label' => 'Service', 'unit_price' => 15000, 'quantity' => 1]],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertCreated();
    }

    private function commercialIn(Agency $agency): User
    {
        $user = User::factory()->create(['role_id' => Role::where('name', 'commercial')->value('id')]);
        Commercial::factory()->create(['user_id' => $user->id, 'agency_id' => $agency->id]);

        return $user;
    }

    public function test_commercial_sale_emails_the_agency_cashiers_only(): void
    {
        $country = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF']);
        $agency = Agency::factory()->create(['country_id' => $country->id]);
        $other = Agency::factory()->create(['country_id' => $country->id]);

        $this->cashier('caisse@agence.test', $agency);
        $this->cashier('caisse@autre.test', $other);

        $this->sellAs($this->commercialIn($agency), $agency);

        Mail::assertSent(PendingInvoiceMail::class, fn ($mail) => $mail->hasTo('caisse@agence.test'));
        Mail::assertNotSent(PendingInvoiceMail::class, fn ($mail) => $mail->hasTo('caisse@autre.test'));
    }

    public function test_falls_back_to_cashiers_of_the_same_country(): void
    {
        $country = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF']);
        $agencyWithoutCashier = Agency::factory()->create(['country_id' => $country->id]);
        $sibling = Agency::factory()->create(['country_id' => $country->id]);

        $this->cashier('caisse@pays.test', $sibling);

        $this->sellAs($this->commercialIn($agencyWithoutCashier), $agencyWithoutCashier);

        Mail::assertSent(PendingInvoiceMail::class, fn ($mail) => $mail->hasTo('caisse@pays.test'));
    }

    public function test_cashier_sale_sends_no_pending_email(): void
    {
        $agency = Agency::factory()->create();
        $cashier = $this->cashier('caisse@agence.test', $agency);

        Sanctum::actingAs($cashier);
        $this->postJson('/api/invoices', [
            'agency_id' => $agency->id,
            'items' => [['label' => 'Service', 'unit_price' => 15000, 'quantity' => 1]],
        ])->assertCreated();

        Mail::assertNothingSent();
    }

    public function test_smtp_failure_does_not_break_the_sale(): void
    {
        $agency = Agency::factory()->create();
        $this->cashier('caisse@agence.test', $agency);
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));

        $this->sellAs($this->commercialIn($agency), $agency);

        $this->assertDatabaseCount('invoices', 1);
    }

    public function test_email_renders(): void
    {
        $agency = Agency::factory()->create();
        $this->cashier('caisse@agence.test', $agency);
        $this->sellAs($this->commercialIn($agency), $agency);

        Mail::assertSent(PendingInvoiceMail::class, function (PendingInvoiceMail $mail) {
            $html = $mail->render();

            return str_contains($html, $mail->invoice->number) && str_contains($html, 'en attente de validation');
        });
    }
}
