<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\CashClosing;
use App\Models\Role;
use App\Models\Setting;
use App\Models\TreasuryAccount;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Points 14a / 14b : clôture et réouverture en masse des caisses, et
 * automatisation à l'heure réglée.
 */
class CashClosingBulkTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;
    private Agency $otherAgency;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $this->agency = Agency::factory()->create();
        $this->otherAgency = Agency::factory()->create();
        $this->admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($this->admin);
    }

    private function account(Agency $agency, string $code = 'C', string $type = 'cash'): TreasuryAccount
    {
        return TreasuryAccount::create([
            'agency_id' => $agency->id,
            'code' => $code,
            'name' => $code,
            'type' => $type,
            'opening_balance' => 10000,
            'currency_code' => 'XAF',
            'is_active' => true,
        ]);
    }

    public function test_close_all_closes_every_open_cash_box(): void
    {
        $this->account($this->agency);
        $this->account($this->otherAgency);
        $this->account($this->agency, 'O', 'mobile_money');

        $this->postJson('/api/treasury/closings/close-all')
            ->assertOk()
            ->assertJson(['closed' => 2, 'skipped' => 0]);

        $this->assertSame(2, CashClosing::whereNull('reopened_at')->count());

        $this->postJson('/api/treasury/closings/close-all')
            ->assertOk()
            ->assertJson(['closed' => 0, 'skipped' => 2]);
    }

    public function test_reopen_all_reopens_every_closed_cash_box(): void
    {
        $this->account($this->agency);
        $this->account($this->otherAgency);

        $this->postJson('/api/treasury/closings/close-all')->assertOk();

        $this->postJson('/api/treasury/closings/reopen-all')
            ->assertOk()
            ->assertJson(['reopened' => 2]);

        $this->assertSame(0, CashClosing::whereNull('reopened_at')->count());
    }

    public function test_auto_close_command_closes_boxes_at_the_configured_time(): void
    {
        $this->account($this->agency);
        Setting::set('cash_auto_closing_enabled', true);
        Setting::set('cash_closing_time', now()->timezone(\App\Support\Period::businessTimezone())->format('H:i'));

        Artisan::call('treasury:auto-close');

        $this->assertSame(1, CashClosing::whereNull('reopened_at')->count());
    }

    public function test_auto_close_command_does_nothing_at_another_time(): void
    {
        $this->account($this->agency);
        Setting::set('cash_auto_closing_enabled', true);
        Setting::set('cash_closing_time', now()->timezone(\App\Support\Period::businessTimezone())->addHour()->format('H:i'));

        Artisan::call('treasury:auto-close');

        $this->assertSame(0, CashClosing::count());
    }

    public function test_auto_reopen_command_reopens_boxes_at_the_configured_time(): void
    {
        $this->account($this->agency);
        $this->postJson('/api/treasury/closings/close-all')->assertOk();

        Setting::set('cash_auto_closing_enabled', true);
        Setting::set('cash_reopening_time', now()->timezone(\App\Support\Period::businessTimezone())->format('H:i'));

        Artisan::call('treasury:auto-reopen');

        $this->assertSame(0, CashClosing::whereNull('reopened_at')->count());
    }

    public function test_auto_commands_respect_the_enabled_setting(): void
    {
        $this->account($this->agency);
        Setting::set('cash_auto_closing_enabled', false);
        Setting::set('cash_closing_time', now()->timezone(\App\Support\Period::businessTimezone())->format('H:i'));

        Artisan::call('treasury:auto-close');

        $this->assertSame(0, CashClosing::count());
    }
}
