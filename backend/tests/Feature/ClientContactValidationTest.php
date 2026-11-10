<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\CountrySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * T8.4 : email et téléphone validés, indicatif cohérent avec le pays.
 */
class ClientContactValidationTest extends TestCase
{
    use RefreshDatabase;

    private Country $cameroon;

    private Country $ivoryCoast;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class, CountrySeeder::class]);
        $this->cameroon = Country::where('code', 'CMR')->firstOrFail();
        $this->ivoryCoast = Country::where('code', 'CIV')->firstOrFail();
        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Awa',
            'last_name' => 'Diop',
            'email' => 'awa.'.uniqid().'@example.test',
            'country_id' => $this->cameroon->id,
        ], $overrides);
    }

    public function test_valid_cameroon_phone_is_accepted(): void
    {
        $this->postJson('/api/clients', $this->payload(['phone' => '+237 6 90 00 00 00']))
            ->assertCreated();
    }

    public function test_valid_ivory_coast_phone_is_accepted(): void
    {
        $this->postJson('/api/clients', $this->payload([
            'country_id' => $this->ivoryCoast->id,
            'phone' => '+225 07 00 00 00 00',
        ]))->assertCreated();
    }

    public function test_phone_with_wrong_country_code_is_rejected(): void
    {
        $this->postJson('/api/clients', $this->payload(['phone' => '+225 07 00 00 00 00']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    public function test_phone_with_letters_is_rejected(): void
    {
        $this->postJson('/api/clients', $this->payload(['phone' => 'appelle-moi']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    public function test_invalid_email_is_rejected(): void
    {
        $this->postJson('/api/clients', $this->payload(['email' => 'pas-un-email']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }
}
