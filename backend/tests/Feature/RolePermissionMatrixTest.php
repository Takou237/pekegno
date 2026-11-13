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
 * Matrice des droits validée par le client le 12/11/2026 (T0.6).
 *
 * - community-manager : exécutant de prestations, aucun droit de vente.
 * - caissier : pas de suppression de client, comptabilité en lecture seule.
 */
class RolePermissionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->agency = Agency::factory()->create();
    }

    private function userFor(string $role): User
    {
        $user = User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
        DB::table('user_assignments')->insert([
            'user_id' => $user->id,
            'agency_id' => $this->agency->id,
            'is_primary' => true,
        ]);

        return $user;
    }

    private function permissionsOf(string $role): array
    {
        return DB::table('role_permission')
            ->join('permissions', 'permissions.id', '=', 'role_permission.permission_id')
            ->where('role_id', Role::where('name', $role)->value('id'))
            ->pluck('permissions.name')
            ->all();
    }

    public function test_community_manager_keeps_only_field_execution_rights(): void
    {
        $permissions = $this->permissionsOf('community-manager');

        $this->assertContains('prestations.consulter', $permissions);
        $this->assertContains('prestation-actions.modifier', $permissions);
        $this->assertContains('clients.consulter', $permissions);

        foreach (['invoices.creer', 'invoices.annuler', 'clients.creer', 'clients.supprimer', 'prospects.consulter', 'orders.creer'] as $forbidden) {
            $this->assertNotContains($forbidden, $permissions, "Le community-manager ne doit pas avoir {$forbidden}.");
        }
    }

    public function test_community_manager_cannot_sell_or_create_clients(): void
    {
        Sanctum::actingAs($this->userFor('community-manager'));

        $this->postJson('/api/clients', ['first_name' => 'Test', 'last_name' => 'Client'])
            ->assertForbidden();

        $this->postJson('/api/invoices', [
            'items' => [['label' => 'Prestation', 'unit_price' => 1000, 'quantity' => 1]],
        ])->assertForbidden();
    }

    public function test_community_manager_can_reach_his_assigned_work(): void
    {
        Sanctum::actingAs($this->userFor('community-manager'));

        $this->getJson('/api/team/missions')->assertOk();
        $this->getJson('/api/prestations')->assertOk();
    }

    public function test_cashier_loses_client_deletion_and_accounting_writes(): void
    {
        $permissions = $this->permissionsOf('caissier');

        $this->assertContains('clients.consulter', $permissions);
        $this->assertContains('invoices.encaisser', $permissions);
        $this->assertContains('comptabilite.consulter', $permissions);

        foreach (['clients.supprimer', 'comptabilite.creer', 'comptabilite.modifier', 'comptabilite.supprimer', 'accounting-categories.creer'] as $forbidden) {
            $this->assertNotContains($forbidden, $permissions, "Le caissier ne doit pas avoir {$forbidden}.");
        }
    }

    public function test_cashier_cannot_write_accounting_entries(): void
    {
        Sanctum::actingAs($this->userFor('caissier'));

        $this->postJson('/api/accounting/transactions', [
            'type' => 'income',
            'label' => 'Écriture interdite',
            'amount' => 1000,
            'transacted_at' => now()->toDateString(),
        ])->assertForbidden();

        $this->getJson('/api/accounting/transactions')->assertOk();
    }
}
