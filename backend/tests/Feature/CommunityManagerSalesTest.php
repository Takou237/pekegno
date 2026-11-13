<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Community-manager = fonctionnalités du commercial : un compte sans fiche
 * vendeur (créé avant l'auto-création) retrouve ses ventes dans Factures et
 * son tableau de bord (cas local « TEST 2 » : inscriptions avec commercial_id null).
 */
class CommunityManagerSalesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function makeInvoice(Agency $agency, array $attrs): Invoice
    {
        return Invoice::create(array_merge([
            'number' => 'PK-TEST-'.uniqid(),
            'agency_id' => $agency->id,
            'client_name' => 'Client Test',
            'invoice_date' => now()->toDateString(),
            'payment_type' => 'cash',
            'total_amount' => 50000,
            'amount_paid' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_PENDING,
        ], $attrs));
    }

    public function test_community_manager_without_profile_sees_own_sales_and_gets_profile(): void
    {
        $agency = Agency::factory()->create();
        $cm = User::factory()->create(['role_id' => Role::where('name', 'community-manager')->value('id')]);
        $other = Commercial::factory()->create(['agency_id' => $agency->id]);

        $own = $this->makeInvoice($agency, ['seller_user_id' => $cm->id, 'created_by' => $cm->id, 'commercial_id' => null]);
        $foreign = $this->makeInvoice($agency, ['commercial_id' => $other->id]);

        Sanctum::actingAs($cm);

        // Factures : ses ventes sans fiche rattachée sont visibles, pas celles des autres.
        $ids = collect($this->getJson('/api/invoices')->assertOk()->json('invoices.data'))->pluck('id');
        $this->assertTrue($ids->contains($own->id));
        $this->assertFalse($ids->contains($foreign->id));

        // Tableau de bord : la fiche est créée au lieu d'un 404, et la vente orpheline lui revient.
        $this->getJson('/api/commercials/me/stats')->assertOk();
        $profile = Commercial::where('user_id', $cm->id)->firstOrFail();
        $this->assertSame($profile->id, $own->fresh()->commercial_id);
        $this->assertSame($other->id, $foreign->fresh()->commercial_id);
    }

    public function test_community_manager_has_commercial_permissions(): void
    {
        $cm = User::factory()->create(['role_id' => Role::where('name', 'community-manager')->value('id')]);
        $commercialPerms = Role::where('name', 'commercial')->first()->permissions()->pluck('name');

        foreach ($commercialPerms as $perm) {
            $this->assertTrue($cm->hasPermission($perm), "Permission manquante : {$perm}");
        }
        $this->assertTrue($cm->hasPermission('prestation-actions.modifier'));
    }
}
