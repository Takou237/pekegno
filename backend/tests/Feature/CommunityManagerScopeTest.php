<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Community-manager = exécutant de prestations (décision client T0.6, option A).
 *
 * Il remplace `CommunityManagerSalesTest`, qui verrouillait le comportement
 * inverse (community-manager vendeur, héritier des droits du commercial) :
 * ce périmètre n'est plus celui du rôle.
 */
class CommunityManagerScopeTest extends TestCase
{
    use RefreshDatabase;

    private User $communityManager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $agency = Agency::factory()->create();
        $this->communityManager = User::factory()->create([
            'role_id' => Role::where('name', 'community-manager')->value('id'),
        ]);
        DB::table('user_assignments')->insert([
            'user_id' => $this->communityManager->id,
            'agency_id' => $agency->id,
            'is_primary' => true,
        ]);
    }

    public function test_community_manager_reaches_sales_like_a_commercial(): void
    {
        Sanctum::actingAs($this->communityManager);

        // Employé qui vend (décision du 13/11) : factures, prospects, sa fiche commerciale.
        $this->getJson('/api/invoices')->assertOk();
        $this->getJson('/api/prospects')->assertOk();
        $this->getJson('/api/commercials/me/stats')->assertOk();
    }

    public function test_community_manager_reaches_his_field_work(): void
    {
        Sanctum::actingAs($this->communityManager);

        $this->getJson('/api/team/missions')->assertOk();
        $this->getJson('/api/prestations')->assertOk();
        $this->getJson('/api/prestation-actions/board')->assertOk();
        $this->getJson('/api/clients')->assertOk();
    }
}
