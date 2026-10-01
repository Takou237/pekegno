<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Prospect;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommercialProspectConversionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Mail::fake();
    }

    public function test_commercial_can_convert_own_prospect(): void
    {
        $agency = Agency::factory()->create();
        $user = User::factory()->create(['role_id' => Role::where('name', 'commercial')->value('id')]);
        Commercial::factory()->create(['user_id' => $user->id, 'agency_id' => $agency->id]);
        Sanctum::actingAs($user);

        $prospect = $this->postJson('/api/prospects', [
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
            'email' => 'jean.dupont@example.com',
            'phone' => '+237690000000',
        ])->assertCreated()->json();

        $client = $this->postJson("/api/prospects/{$prospect['id']}/convert")->assertCreated()->json();

        // Le client converti reste dans le périmètre du commercial : il doit le
        // retrouver dans ses clients et dans la recherche « apprenant » d'une vente.
        $this->getJson('/api/clients/search?q=Dupont')
            ->assertOk()
            ->assertJsonFragment(['id' => $client['id']]);

        $this->assertDatabaseHas('users', [
            'id' => $client['id'],
            'registered_agency_id' => $agency->id,
            'commercial_user_id' => $user->id,
        ]);
    }
}
