<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Les clients sont globaux : un commercial retrouve n'importe quel client
 * (créé par l'admin, dans une autre agence…) pour lui vendre, sans tenir
 * compte de la casse.
 */
class GlobalClientSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_commercial_finds_any_client_case_insensitively(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $abidjan = Agency::factory()->create();
        $bouake = Agency::factory()->create();

        $commercial = User::factory()->create(['role_id' => Role::where('name', 'commercial')->value('id')]);
        Commercial::factory()->create(['user_id' => $commercial->id, 'agency_id' => $abidjan->id]);
        $commercial->assignments()->sync([$abidjan->id => ['is_primary' => false]]);

        User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
            'first_name' => 'MICHEL',
            'last_name' => 'KENGNE',
            'registered_agency_id' => $bouake->id,
        ]);

        Sanctum::actingAs($commercial);
        $this->getJson('/api/clients/search?q=mich')->assertOk()->assertJsonCount(1)->assertJsonPath('0.last_name', 'KENGNE');
        $this->getJson('/api/clients?search=kengne')->assertOk()->assertJsonPath('data.0.first_name', 'MICHEL');
    }
}
