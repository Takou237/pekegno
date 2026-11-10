<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * B29 — « Cette année » (période par défaut) s'arrêtait au 04/11 alors qu'on
 * était le 03/11 : la fin du jour était calculée en UTC. Les bornes par
 * défaut suivent désormais le jour métier (Douala, UTC+1).
 */
class DefaultPeriodTimezoneTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_default_period_ends_today_in_business_time(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
        Carbon::setTestNow('2026-11-03 10:00:00');

        foreach (['/api/reports/customers', '/api/reports/comparison'] as $url) {
            $period = $this->getJson($url)->assertOk()->json('period');
            $this->assertNotNull($period, $url);

            $local = fn (string $iso) => Carbon::parse($iso)->timezone('Africa/Douala');
            $this->assertSame('2026-11-03', $local($period['to'])->toDateString(), $url);
            $this->assertSame('23:59', $local($period['to'])->format('H:i'), $url);
            $this->assertSame('2026-01-01 00:00', $local($period['from'])->format('Y-m-d H:i'), $url);
        }
    }
}
