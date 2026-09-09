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

class Phase5CommercialValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function createCommercialUser(): User
    {
        $agency = Agency::factory()->create();
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        Commercial::factory()->create([
            'user_id' => $user->id,
            'agency_id' => $agency->id,
        ]);

        return $user;
    }

    private function actingAsRole(string $roleName): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_commercial_created_invoice_is_pending_and_cannot_be_collected(): void
    {
        $commercial = $this->createCommercialUser();
        Sanctum::actingAs($commercial);

        $invoice = $this->postJson('/api/invoices', [
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $this->assertSame(Invoice::VALIDATION_PENDING, $invoice['validation_status']);

        // Le commercial ne peut ni encaisser (permission retirée) ni valider.
        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 5000,
            'payment_method' => 'cash',
        ])->assertStatus(403);

        $this->postJson("/api/invoices/{$invoice['id']}/validate")
            ->assertStatus(403);
    }

    public function test_cashier_validates_then_collects_pending_commercial_invoice(): void
    {
        $commercial = $this->createCommercialUser();
        Sanctum::actingAs($commercial);

        $invoice = $this->postJson('/api/invoices', [
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        // Le caissier valide la facture en attente.
        $this->actingAsRole('caissier');
        $validated = $this->postJson("/api/invoices/{$invoice['id']}/validate")
            ->assertOk()
            ->json();

        $this->assertSame(Invoice::VALIDATION_VALIDATED, $validated['validation_status']);

        // Ensuite il peut encaisser.
        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 15000,
            'payment_method' => 'cash',
        ])->assertOk();
    }

    public function test_admin_counter_sale_without_commercial_is_validated_directly(): void
    {
        $this->actingAsRole('super-admin');

        $invoice = $this->postJson('/api/invoices', [
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $this->assertSame(Invoice::VALIDATION_VALIDATED, $invoice['validation_status']);

        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 15000,
            'payment_method' => 'cash',
        ])->assertOk();
    }

    public function test_commercial_stats_rise_after_validation_and_collection(): void
    {
        $agency = Agency::factory()->create();
        $commercialUser = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        $commercial = Commercial::factory()->create([
            'user_id' => $commercialUser->id,
            'agency_id' => $agency->id,
            'commission_type' => 'percent',
            'commission_value' => 10,
        ]);
        Sanctum::actingAs($commercialUser);

        // 2 articles : quantités 2 et 3 → nombre de ventes attendu = 5
        // NB : commercial_id n'est PAS envoyé, comme dans l'écran réel (vente rapide) :
        // le backend doit rattacher automatiquement la facture au profil du commercial.
        $invoice = $this->postJson('/api/invoices', [
            'agency_id' => $agency->id,
            'items' => [
                ['label' => 'Massage', 'unit_price' => 10000, 'quantity' => 2],
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 3],
            ],
        ])->assertStatus(201)->json();

        $total = 2 * 10000 + 3 * 15000; // 65000

        // La facture a été rattachée automatiquement au profil du commercial.
        $this->assertSame($commercial->id, $invoice['commercial_id']);

        // Avant validation/encaissement : aucune vente comptabilisée.
        $stats = $this->scopedStats($commercial->id);
        $this->assertSame(0, (int) $stats['sales_count']);
        $this->assertSame(0.0, (float) $stats['turnover']);
        $this->assertSame(0.0, (float) $stats['commissions']);

        // Le caissier valide : toujours pas comptabilisé (pas encore encaissé).
        $this->actingAsRole('caissier');
        $this->postJson("/api/invoices/{$invoice['id']}/validate")->assertOk();
        $stats = $this->scopedStats($commercial->id);
        $this->assertSame(0, (int) $stats['sales_count']);
        $this->assertSame(0.0, (float) $stats['turnover']);

        // Le caissier encaisse → les stats du commercial montent.
        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => $total,
            'payment_method' => 'cash',
        ])->assertOk();

        $stats = $this->scopedStats($commercial->id);
        $this->assertSame(5, (int) $stats['sales_count']);
        $this->assertSame((float) $total, (float) $stats['turnover']);
        $this->assertGreaterThan(0, (float) $stats['commissions']);

        // La facture validée + encaissée figure dans l'historique du commercial.
        Sanctum::actingAs($commercialUser);
        $list = $this->getJson('/api/invoices?commercial_id='.$commercial->id)
            ->assertOk()
            ->json('invoices.data');
        $this->assertContains($invoice['id'], array_column($list, 'id'));
    }

    private function scopedStats(string $commercialId): array
    {
        $this->actingAsRole('super-admin');
        return $this->getJson("/api/commercials/{$commercialId}/stats")
            ->assertOk()
            ->json();
    }
}
