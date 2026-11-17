<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Role;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Point 10 : le sélecteur de nouveau formateur propose tous les comptes
 * internes de l'agence, pas seulement ceux ayant déjà le rôle « formateur ».
 */
class TrainerLinkUserTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function admin(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));
    }

    private function userWithRole(string $roleName, ?Agency $agency = null): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
        ]);

        if ($agency) {
            DB::table('user_assignments')->insert([
                'user_id' => $user->id,
                'agency_id' => $agency->id,
                'is_primary' => false,
            ]);
        }

        return $user;
    }

    private function trainer(Agency $agency, ?User $user = null): Trainer
    {
        return Trainer::create([
            'agency_id' => $agency->id,
            'user_id' => $user?->id,
            'first_name' => $user?->first_name ?? 'Intervenant',
            'last_name' => $user?->last_name ?? 'Externe',
            'email' => $user?->email ?? 'externe@example.test',
            'is_active' => true,
        ]);
    }

    public function test_available_users_lists_every_internal_account_of_the_agency(): void
    {
        $this->admin();
        $agency = Agency::factory()->create();
        $otherAgency = Agency::factory()->create();

        $commercial = $this->userWithRole('commercial', $agency);
        $caissier = $this->userWithRole('caissier', $agency);
        $client = $this->userWithRole('client', $agency);
        $otherAgencyUser = $this->userWithRole('commercial', $otherAgency);

        $linkedFormateur = $this->userWithRole('formateur', $agency);
        $this->trainer($agency, $linkedFormateur);

        $response = $this->getJson("/api/trainers/available-users?agency_id={$agency->id}")->assertOk();
        $ids = collect($response->json())->pluck('id');

        $this->assertTrue($ids->contains($commercial->id), 'Un commercial de l\'agence doit être proposé.');
        $this->assertTrue($ids->contains($caissier->id), 'Un caissier de l\'agence doit être proposé.');
        $this->assertFalse($ids->contains($client->id), 'Un compte client ne doit pas être proposé.');
        $this->assertFalse($ids->contains($linkedFormateur->id), 'Un compte déjà lié ne doit pas être proposé.');
        $this->assertFalse($ids->contains($otherAgencyUser->id), 'Un compte d\'une autre agence ne doit pas être proposé.');

        $commercialRow = collect($response->json())->firstWhere('id', $commercial->id);
        $this->assertSame('commercial', $commercialRow['role']);
    }

    public function test_an_internal_account_can_be_linked_to_a_trainer_profile(): void
    {
        $this->admin();
        $agency = Agency::factory()->create();
        $commercial = $this->userWithRole('commercial', $agency);
        $trainer = $this->trainer($agency);

        $this->postJson("/api/trainers/{$trainer->id}/link-user", [
            'user_id' => $commercial->id,
        ])->assertOk();

        $this->assertSame($commercial->id, $trainer->fresh()->user_id);
    }

    public function test_a_client_account_cannot_be_linked(): void
    {
        $this->admin();
        $agency = Agency::factory()->create();
        $client = $this->userWithRole('client', $agency);
        $trainer = $this->trainer($agency);

        $this->postJson("/api/trainers/{$trainer->id}/link-user", [
            'user_id' => $client->id,
        ])->assertStatus(422);

        $this->assertNull($trainer->fresh()->user_id);
    }
}
