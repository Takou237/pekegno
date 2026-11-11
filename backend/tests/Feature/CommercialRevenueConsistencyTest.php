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
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Rapport commercial à 0 (filtre sur le compte utilisateur) et chiffres
 * différents entre le tableau de bord du commercial et « Meilleurs
 * commerciaux » : une seule définition du CA d'un commercial.
 */
class CommercialRevenueConsistencyTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function invoice(Commercial $commercial, float $total, array $lines, array $extra = []): Invoice
    {
        $this->seq++;
        $invoice = Invoice::create(array_merge([
            'number' => sprintf('PK-COM-%03d', $this->seq),
            'agency_id' => $commercial->agency_id,
            'commercial_id' => $commercial->id,
            'invoice_date' => '2026-11-05',
            'total_amount' => $total,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'source' => 'in_person',
        ], $extra));
        foreach ($lines as $line) {
            $invoice->items()->create($line + ['label' => 'Ligne', 'quantity' => 1, 'unit_price' => $line['line_total']]);
        }

        return $invoice;
    }

    public function test_all_commercial_screens_show_the_same_revenue(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Carbon::setTestNow('2026-11-10 10:00:00');

        $agency = Agency::factory()->create();
        $user = User::factory()->create(['role_id' => Role::where('name', 'commercial')->value('id')]);
        $user->assignments()->sync([$agency->id => ['is_primary' => false]]);
        $commercial = Commercial::factory()->create(['user_id' => $user->id, 'agency_id' => $agency->id]);

        // Payée, 2 lignes (comptée une seule fois) : 100 000, 2 ventes.
        $this->invoice($commercial, 100000, [['line_total' => 60000], ['line_total' => 40000]], ['status' => 'paid', 'amount_paid' => 100000]);
        // Validée non payée : 50 000 (elle compte dans le CA).
        $this->invoice($commercial, 50000, [['line_total' => 50000]]);
        // Avec budget pub client : 140 000 dont 40 000 exclus → 100 000.
        $this->invoice($commercial, 140000, [['line_total' => 100000], ['line_total' => 40000, 'is_pass_through' => true]]);
        // Ni les factures en attente ni les annulées.
        $this->invoice($commercial, 30000, [['line_total' => 30000]], ['validation_status' => Invoice::VALIDATION_PENDING]);
        $this->invoice($commercial, 20000, [['line_total' => 20000]], ['cancelled_at' => now()]);

        $admin = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
        Sanctum::actingAs($admin);
        $period = 'from=2026-11-01&to=2026-11-10';

        // Rapport commercial : l'écran envoie l'identifiant du compte utilisateur.
        $row = $this->getJson("/api/commercials/report?{$period}&commercial_id={$user->id}")->assertOk()->json('ranking.0');
        $this->assertNotNull($row, 'Le rapport ne doit plus être vide.');
        $this->assertEquals(250000, $row['revenue_billed']);
        $this->assertSame(5, $row['sales_count']);

        // Classement « Meilleurs commerciaux ».
        $top = collect($this->getJson("/api/stats/top-commercials?{$period}")->assertOk()->json())->firstWhere('id', $commercial->id);
        $this->assertEquals(250000, $top['turnover']);
        $this->assertSame(5, $top['sales_count']);

        // Tableau de bord du commercial.
        Sanctum::actingAs($user);
        $me = $this->getJson('/api/commercials/me/stats')->assertOk()->json();
        $this->assertEquals(250000, $me['turnover']);
        $this->assertSame(5, $me['sales_count']);
    }
}
