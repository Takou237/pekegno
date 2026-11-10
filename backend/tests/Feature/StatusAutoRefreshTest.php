<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Contract;
use App\Models\Course;
use App\Models\Role;
use App\Models\TrainingSession;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * B20 — Les statuts de session se calculent depuis les dates et la commande
 * `contracts:refresh-status` met à jour les contrats.
 */
class StatusAutoRefreshTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    public function test_session_status_is_computed_from_dates(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-10 10:00:00'));
        $course = Course::factory()->create();

        $past = TrainingSession::factory()->create([
            'course_id' => $course->id,
            'start_at' => '2026-11-01 09:00:00',
            'end_at' => '2026-11-01 12:00:00',
            'status' => 'planned',
        ]);

        $ongoing = TrainingSession::factory()->create([
            'course_id' => $course->id,
            'start_at' => '2026-11-10 09:00:00',
            'end_at' => '2026-11-10 12:00:00',
            'status' => 'planned',
        ]);

        $future = TrainingSession::factory()->create([
            'course_id' => $course->id,
            'start_at' => '2026-11-12 09:00:00',
            'end_at' => '2026-11-12 12:00:00',
            'status' => 'planned',
        ]);

        $cancelled = TrainingSession::factory()->create([
            'course_id' => $course->id,
            'start_at' => '2026-11-01 09:00:00',
            'end_at' => '2026-11-01 12:00:00',
            'status' => 'cancelled',
        ]);

        $this->assertSame('completed', $past->fresh()->status);
        $this->assertSame('ongoing', $ongoing->fresh()->status);
        $this->assertSame('planned', $future->fresh()->status);
        $this->assertSame('cancelled', $cancelled->fresh()->status);

        Carbon::setTestNow();
    }

    public function test_contract_statuses_are_refreshed_by_the_command(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-10 10:00:00'));

        $agency = Agency::factory()->create();
        $client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);

        $contract = fn (string $number, string $end): Contract => Contract::create([
            'number' => $number,
            'client_id' => $client->id,
            'agency_id' => $agency->id,
            'start_date' => '2026-11-01',
            'end_date' => $end,
            'billing_cycle' => 'yearly',
            'amount' => 100000,
            'status' => Contract::STATUS_ACTIVE,
        ]);

        $expired = $contract('CTR-00004', '2026-11-09');
        $dueSoon = $contract('CTR-00014', '2026-11-20');
        $later = $contract('CTR-00012', '2027-06-30');

        $this->artisan('contracts:refresh-status')->assertSuccessful();

        $this->assertSame(Contract::STATUS_EXPIRED, $expired->fresh()->status);
        $this->assertSame(Contract::STATUS_DUE_SOON, $dueSoon->fresh()->status);
        $this->assertSame(Contract::STATUS_ACTIVE, $later->fresh()->status);

        Carbon::setTestNow();
    }
}
