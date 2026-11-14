<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Agency;
use App\Models\Country;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Rôles (14/11) :
 * - directeur général : tout ce que fait le super-admin, sans voir le
 *   super-admin ni ses actions dans l'audit, et sans pouvoir créer de super-admin ;
 * - directeur : l'ancien « directeur général rattaché à un pays », limité à son pays.
 */
class RoleRestructureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function user(string $role, array $extra = []): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')] + $extra);
    }

    public function test_general_director_does_not_see_super_admin_in_audit(): void
    {
        $super = $this->user('super-admin');
        $dg = $this->user('direction-generale');
        $other = $this->user('commercial');

        ActivityLog::create(['user_id' => $super->id, 'action' => 'login', 'entity_type' => 'user', 'entity_id' => $super->id, 'description' => 'Connexion super-admin']);
        ActivityLog::create(['user_id' => $dg->id, 'action' => 'updated', 'entity_type' => 'user', 'entity_id' => $super->id, 'description' => 'Action sur le compte super-admin']);
        ActivityLog::create(['user_id' => $other->id, 'action' => 'login', 'entity_type' => 'user', 'entity_id' => $other->id, 'description' => 'Connexion commercial']);

        Sanctum::actingAs($dg);
        $seen = collect($this->getJson('/api/activity-logs?per_page=100')->assertOk()->json('data'))->pluck('description');
        $this->assertSame(['Connexion commercial'], $seen->values()->all());

        Sanctum::actingAs($super);
        $this->assertCount(3, $this->getJson('/api/activity-logs?per_page=100')->assertOk()->json('data'));
    }

    public function test_general_director_creates_general_directors_and_directors_but_not_super_admins(): void
    {
        $country = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF']);
        Sanctum::actingAs($this->user('direction-generale'));

        $payload = fn (string $role, string $login, array $extra = []) => [
            'username' => $login, 'email' => "{$login}@example.com", 'first_name' => 'X', 'last_name' => 'Y',
            'role_id' => Role::where('name', $role)->value('id'),
        ] + $extra;

        $this->postJson('/api/users', $payload('super-admin', 'sa2'))->assertStatus(422);
        $this->postJson('/api/users', $payload('direction-generale', 'dg2'))->assertCreated();
        $this->postJson('/api/users', $payload('directeur', 'dir1', ['country_id' => $country->id]))->assertCreated();
    }

    public function test_director_is_limited_to_his_country_and_general_director_sees_everything(): void
    {
        $cmr = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF']);
        $civ = Country::create(['name' => "Côte d'Ivoire", 'code' => 'CIV', 'currency_code' => 'XOF']);
        $douala = Agency::factory()->create(['country_id' => $cmr->id]);
        $abidjan = Agency::factory()->create(['country_id' => $civ->id]);

        $scope = app(\App\Services\ScopeService::class);

        $director = $this->user('directeur', ['country_id' => $cmr->id]);
        $this->assertSame([$douala->id], $scope->agencyIds($director));

        // Un directeur sans pays ne voit rien (jamais tout le groupe).
        $this->assertSame([], $scope->agencyIds($this->user('directeur')));

        // Le directeur général voit tout, même avec un pays renseigné.
        $this->assertNull($scope->agencyIds($this->user('direction-generale', ['country_id' => $cmr->id])));
        $this->assertTrue($this->user('direction-generale')->hasPermission('n-importe.quoi'));
        $this->assertFalse($director->hasFullAccess());
    }
}
