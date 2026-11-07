<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Department;
use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\PrestationActionExecution;
use App\Models\Role;
use App\Models\Trainer;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * « Mes réalisations » de l'espace formateur : exécutions du pôle studio
 * assignées au compte, mises à jour limitées à l'avancement.
 */
class TrainerRealizationTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Carbon::setTestNow('2026-11-10 10:00:00');
        $this->agency = Agency::factory()->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    /** Commercial lié à un profil formateur (« Compte lié »). */
    private function linkedTrainer(): User
    {
        $user = $this->user('commercial');
        Trainer::create([
            'agency_id' => $this->agency->id,
            'user_id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'is_active' => true,
        ]);

        return $user;
    }

    private function action(string $departmentType, ?string $assignedTo, string $status = 'in_progress'): PrestationAction
    {
        $this->seq++;
        $department = Department::factory()->create(['agency_id' => $this->agency->id, 'type' => $departmentType]);
        $prestation = Prestation::create([
            'reference' => sprintf('PR-TR-%03d', $this->seq),
            'agency_id' => $this->agency->id,
            'department_id' => $department->id,
            'name' => 'Tournage '.$this->seq,
            'client_id' => User::factory()->create()->id,
            'start_date' => '2026-11-02',
            'end_date' => '2026-11-15',
            'status' => $status,
        ]);

        return $prestation->actions()->create([
            'title' => 'Montage vidéo',
            'type' => 'content_production',
            'status' => 'todo',
            'quantity' => 1,
            'frequency' => 'once',
            'assigned_to' => $assignedTo,
            'due_date' => '2026-11-08',
        ]);
    }

    private function execution(PrestationAction $action, ?string $assignedTo, array $extra = []): PrestationActionExecution
    {
        return PrestationActionExecution::create(array_merge([
            'prestation_action_id' => $action->id,
            'week_number' => 1,
            'occurrence_number' => 1,
            'title' => 'Montage #1',
            'status' => 'todo',
            'scheduled_date' => '2026-11-12',
            'assigned_to' => $assignedTo,
        ], $extra));
    }

    public function test_only_trainer_accounts_reach_the_space(): void
    {
        Sanctum::actingAs($this->user('commercial'));
        $this->getJson('/api/trainers/me/realizations')->assertForbidden();

        Sanctum::actingAs($this->user('formateur'));
        $this->getJson('/api/trainers/me/realizations')->assertOk();

        Sanctum::actingAs($this->linkedTrainer());
        $this->getJson('/api/trainers/me/realizations')->assertOk();
    }

    public function test_lists_my_studio_realizations_with_summary(): void
    {
        $me = $this->linkedTrainer();
        $other = $this->user('commercial');

        $mineDirect = $this->execution($this->action('studio', null), $me->id, ['scheduled_date' => '2026-11-05']);
        $mineViaAction = $this->execution($this->action('studio', $me->id), null);
        $this->execution($this->action('studio', $me->id), $other->id);   // réassignée à un autre
        $this->execution($this->action('agency', null), $me->id);         // hors pôle studio
        $this->execution($this->action('studio', null), $me->id, ['status' => 'done', 'done_at' => '2026-11-09']);

        Sanctum::actingAs($me);
        $response = $this->getJson('/api/trainers/me/realizations')->assertOk();

        $this->assertSame(3, $response->json('total'));
        $this->assertEqualsCanonicalizing(
            [$mineDirect->id, $mineViaAction->id],
            collect($response->json('data'))->where('status', 'todo')->pluck('id')->all()
        );
        $this->assertSame(['total' => 3, 'todo' => 2, 'in_progress' => 0, 'done' => 1, 'overdue' => 1], $response->json('summary'));
        $this->assertSame('studio', $response->json('data.0.action.prestation.department.type'));

        $overdue = $this->getJson('/api/trainers/me/realizations?overdue=1')->assertOk();
        $this->assertSame([$mineDirect->id], collect($overdue->json('data'))->pluck('id')->all());

        $this->assertSame(1, $this->getJson('/api/trainers/me/realizations?status=done')->json('total'));
    }

    public function test_generates_executions_of_actions_assigned_to_me(): void
    {
        $me = $this->user('formateur');
        $action = $this->action('studio', $me->id);
        $this->action('studio', $me->id, 'draft'); // pas encore validée : rien à réaliser

        Sanctum::actingAs($me);
        $response = $this->getJson('/api/trainers/me/realizations')->assertOk();

        $this->assertSame(1, $response->json('total'));
        $this->assertSame($action->id, $response->json('data.0.prestation_action_id'));
    }

    public function test_trainer_completes_a_realization(): void
    {
        $me = $this->linkedTrainer();
        $action = $this->action('studio', $me->id);
        $execution = $this->execution($action, null);

        Sanctum::actingAs($me);
        $this->putJson("/api/trainers/me/realizations/{$execution->id}", [
            'status' => 'done',
            'done_at' => '2026-11-09',
            'proof_url' => 'https://example.com/video',
            'actual_cost' => 15000,
            'note' => 'Livré au client',
        ])->assertOk()
            ->assertJsonPath('status', 'done')
            ->assertJsonPath('action.prestation.department.type', 'studio');

        $execution->refresh();
        $this->assertSame('2026-11-09', $execution->done_at->toDateString());
        $this->assertSame($me->id, $execution->user_id);
        $this->assertSame(15000.0, (float) $action->fresh()->actual_cost);
    }

    public function test_trainer_cannot_touch_other_realizations_or_cancel(): void
    {
        $me = $this->linkedTrainer();
        $foreign = $this->execution($this->action('studio', null), $this->user('commercial')->id);
        $mine = $this->execution($this->action('studio', null), $me->id);
        $cancelled = $this->execution($this->action('studio', null), $me->id, ['status' => 'cancelled']);

        Sanctum::actingAs($me);
        $this->putJson("/api/trainers/me/realizations/{$foreign->id}", ['status' => 'done'])->assertForbidden();
        $this->putJson("/api/trainers/me/realizations/{$mine->id}", ['status' => 'cancelled'])->assertUnprocessable();
        $this->putJson("/api/trainers/me/realizations/{$mine->id}", ['done_at' => '2026-12-01'])->assertUnprocessable();
        $this->putJson("/api/trainers/me/realizations/{$cancelled->id}", ['status' => 'done'])->assertUnprocessable();

        // Titre / affectation ignorés : hors périmètre du formateur.
        $this->putJson("/api/trainers/me/realizations/{$mine->id}", ['status' => 'in_progress', 'assigned_to' => null, 'title' => 'X'])->assertOk();
        $this->assertSame($me->id, $mine->fresh()->assigned_to);
        $this->assertSame('Montage #1', $mine->fresh()->title);
    }
}
