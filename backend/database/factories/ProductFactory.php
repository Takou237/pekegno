<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'sku' => fake()->unique()->regexify('PRD-[0-9]{5}'),
            'name' => ucfirst(fake()->words(3, true)),
            'description' => fake()->optional()->sentence(),
            'brand' => fake()->optional()->company(),
            'purchase_price' => 5000,
            'selling_price' => 10000,
            'tax_rate' => 0,
            'is_stock_managed' => false,
            'is_active' => true,
            'agency_id' => null,
        ];
    }
}