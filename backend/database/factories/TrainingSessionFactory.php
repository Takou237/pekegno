<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\TrainingSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TrainingSession>
 */
class TrainingSessionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'course_id' => Course::factory(),
            'trainer_user_id' => null,
            'agency_id' => null,
            'start_at' => now()->addWeek(),
            'end_at' => now()->addWeek()->addHours(fake()->numberBetween(2, 8)),
            'max_capacity' => fake()->numberBetween(5, 50),
            'price' => null,
            'status' => 'planned',
        ];
    }
}