<?php

namespace Database\Factories;

use App\Models\Agency;
use App\Models\Commercial;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Commercial>
 */
class CommercialFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => Agency::factory(),
            'user_id' => null,
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->optional()->phoneNumber(),
            'commission_type' => 'percent',
            'commission_value' => 5,
            'points_balance' => 0,
            'is_active' => true,
        ];
    }
}
