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

    public function test_commercial_searches_his_clients_and_finds_others_only_by_exact_contact(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $abidjan = Agency::factory()->create();
        $bouake = Agency::factory()->create();

        $commercial = User::factory()->create(['role_id' => Role::where('name', 'commercial')->value('id')]);
        Commercial::factory()->create(['user_id' => $commercial->id, 'agency_id' => $abidjan->id]);
        $commercial->assignments()->sync([$abidjan->id => ['is_primary' => false]]);

        $clientRole = Role::where('name', 'client')->value('id');
        User::factory()->create([
            'role_id' => $clientRole,
            'first_name' => 'MICHEL',
            'last_name' => 'KENGNE',
            'registered_agency_id' => $abidjan->id,
            'commercial_user_id' => $commercial->id,
        ]);
        $other = User::factory()->create([
            'role_id' => $clientRole,
            'first_name' => 'MICHELLE',
            'last_name' => 'NDOUMBE',
            'email' => 'michelle.ndoumbe@example.com',
            'registered_agency_id' => $bouake->id,
        ]);

        Sanctum::actingAs($commercial);
        // Recherche insensible à la casse, limitée à ses clients.
        $this->getJson('/api/clients/search?q=mich')->assertOk()->assertJsonCount(1)->assertJsonPath('0.last_name', 'KENGNE');
        $this->getJson('/api/clients?search=kengne')->assertOk()->assertJsonPath('data.0.first_name', 'MICHEL');
        // Le client d'un autre : seulement par son email exact (pour lui vendre).
        $this->getJson('/api/clients/search?q=Michelle.Ndoumbe@example.com')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $other->id);
    }
}
