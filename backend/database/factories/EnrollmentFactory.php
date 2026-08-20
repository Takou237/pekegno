<?php

namespace Database\Factories;

use App\Models\Enrollment;
use App\Models\TrainingSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Enrollment>
 */
class EnrollmentFactory extends Factory
{
    public function definition(): array
    {
        $client = User::factory()->create([
            'role_id' => \App\Models\Role::where('name', 'client')->value('id'),
        ]);

        return [
            'session_id' => TrainingSession::factory(),
            'learner_user_id' => $client->id,
            'status' => 'enrolled',
            'attendance' => false,
            'attended_at' => null,
            'notes' => null,
        ];
    }
}