<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Role;
use App\Models\Trainer;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * T8.5 : impossible de créer une session sans formateur.
 */
class SessionRequiresTrainerTest extends TestCase
{
    use RefreshDatabase;

    private User $trainerUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));

        $this->trainerUser = User::factory()->create([
            'role_id' => Role::where('name', 'formateur')->value('id'),
        ]);
    }

    private function payload(): array
    {
        return [
            'course_id' => Course::factory()->create()->id,
            'start_at' => now()->addDays(7)->toISOString(),
        ];
    }

    public function test_session_without_trainer_is_rejected(): void
    {
        $this->postJson('/api/training-sessions', $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors(['trainer_id', 'trainer_user_id']);
    }

    public function test_session_with_trainer_user_is_accepted(): void
    {
        $this->postJson('/api/training-sessions', $this->payload() + [
            'trainer_user_id' => $this->trainerUser->id,
        ])->assertCreated();
    }

    public function test_session_with_trainer_profile_is_accepted(): void
    {
        $trainer = Trainer::create([
            'user_id' => $this->trainerUser->id,
            'first_name' => $this->trainerUser->first_name,
            'last_name' => $this->trainerUser->last_name,
            'email' => $this->trainerUser->email,
            'phone' => $this->trainerUser->phone,
            'is_active' => true,
        ]);

        $this->postJson('/api/training-sessions', $this->payload() + [
            'trainer_id' => $trainer->id,
        ])->assertCreated();
    }
}
