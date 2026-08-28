<?php

namespace Database\Factories;

use App\Models\Course;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Course>
 */
class CourseFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => fake()->unique()->regexify('CRS-[0-9]{5}'),
            'name' => ucfirst(fake()->unique()->words(3, true)),
            'description' => fake()->optional()->sentence(),
            'mode' => fake()->randomElement(['online', 'in_person', 'mixed']),
            'price' => fake()->randomElement([25000, 50000, 75000]),
            'duration_hours' => fake()->numberBetween(4, 60),
            'agency_id' => null,
            'is_active' => true,
        ];
    }
}