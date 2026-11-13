<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AgencyNotification;
use App\Models\Commercial;
use App\Models\Department;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use App\Services\OverdueInvoiceNotifier;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Lot 7 — déclencheur « créance échue ».
 *
 * Une facture validée, non annulée, non soldée et dont l'échéance est passée
 * notifie le commercial vendeur et le chef d'agence, une seule fois.
 */
class OverdueInvoiceNotificationTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private Department $department;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            CitySeeder::class,
        ]);

        $this->agency = Agency::factory()->create();
        $this->department = Department::factory()->create([
            'agency_id' => $this->agency->id,
            'type' => Department::TYPE_AGENCY,
        ]);
    }

    private function userWithRole(string $role, bool $chief = false): User
    {
        $user = User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);

        DB::table('user_assignments')->insert([
            'user_id' => $user->id,
            'agency_id' => $this->agency->id,
            'department_id' => null,
            'is_primary' => $chief,
            'is_department_chief' => false,
        ]);

        return $user;
    }

    private function invoice(array $overrides = []): Invoice
    {
        $this->seq++;

        return Invoice::create(array_merge([
            'number' => sprintf('PK-OV-%03d', $this->seq),
            'agency_id' => $this->agency->id,
            'invoice_date' => today()->subDays(40)->toDateString(),
            'client_name' => 'Client Créance',
            'total_amount' => 100000,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'source' => 'in_person',
        ], $overrides));
    }

    public function test_overdue_invoice_notifies_commercial_and_agency_chief_once(): void
    {
        $chief = $this->userWithRole('responsable-agence', chief: true);
        $commercialUser = $this->userWithRole('commercial');
        $commercial = Commercial::factory()->create([
            'agency_id' => $this->agency->id,
            'user_id' => $commercialUser->id,
            'commission_type' => 'none',
            'commission_value' => 0,
        ]);

        $invoice = $this->invoice(['commercial_id' => $commercial->id]);

        $service = app(OverdueInvoiceNotifier::class);
        $first = $service->run();
        $service->run();

        $this->assertSame(['overdue' => 1, 'notified' => 2], $first);
        $this->assertSame(1, AgencyNotification::where('user_id', $chief->id)->where('type', 'invoice_overdue')->count());
        $this->assertSame(1, AgencyNotification::where('user_id', $commercialUser->id)->where('type', 'invoice_overdue')->count());
        $this->assertSame(1, AgencyNotification::where('user_id', $chief->id)->where('dedupe_key', "invoice:{$invoice->id}:overdue")->count());
        $this->assertSame(1, AgencyNotification::where('user_id', $commercialUser->id)->where('dedupe_key', "invoice:{$invoice->id}:overdue")->count());
    }

    public function test_recent_paid_or_cancelled_invoices_are_not_notified(): void
    {
        $this->userWithRole('responsable-agence', chief: true);

        $this->invoice(['invoice_date' => today()->subDays(10)->toDateString()]);
        $this->invoice(['invoice_date' => today()->subDays(60)->toDateString(), 'amount_paid' => 100000, 'status' => 'paid']);
        $this->invoice(['invoice_date' => today()->subDays(60)->toDateString(), 'cancelled_at' => now(), 'status' => 'cancelled']);

        $result = app(OverdueInvoiceNotifier::class)->run();

        $this->assertSame(['overdue' => 0, 'notified' => 0], $result);
        $this->assertSame(0, AgencyNotification::where('type', 'invoice_overdue')->count());
    }

    public function test_explicit_due_date_overrides_the_default_term(): void
    {
        $this->userWithRole('responsable-agence', chief: true);

        $overdue = $this->invoice([
            'invoice_date' => today()->subDays(2)->toDateString(),
            'due_date' => today()->subDay()->toDateString(),
        ]);
        $notYet = $this->invoice([
            'invoice_date' => today()->subDays(60)->toDateString(),
            'due_date' => today()->addDays(10)->toDateString(),
        ]);

        app(OverdueInvoiceNotifier::class)->run();

        $this->assertSame(1, AgencyNotification::where('entity_id', $overdue->id)->where('type', 'invoice_overdue')->count());
        $this->assertSame(0, AgencyNotification::where('entity_id', $notYet->id)->where('type', 'invoice_overdue')->count());
    }

    public function test_due_days_are_configurable_per_agency(): void
    {
        $this->userWithRole('responsable-agence', chief: true);
        Setting::set("agency_invoice_due_days:{$this->agency->id}", 10);

        $this->assertSame(10, app(OverdueInvoiceNotifier::class)->dueDaysForAgency($this->agency->id));

        $this->invoice(['invoice_date' => today()->subDays(15)->toDateString()]);

        $result = app(OverdueInvoiceNotifier::class)->run();
        $this->assertSame(1, $result['overdue']);
    }

    public function test_overdue_check_command_creates_notifications(): void
    {
        $chief = $this->userWithRole('responsable-agence', chief: true);
        $this->invoice();

        $this->assertSame(0, Artisan::call('invoices:check-overdue'));
        $this->assertSame(1, AgencyNotification::where('user_id', $chief->id)->where('type', 'invoice_overdue')->count());
        $this->assertSame(0, Artisan::call('invoices:check-overdue'));
    }
}
