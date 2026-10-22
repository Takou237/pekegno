<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\CommissionEntry;
use App\Models\CommissionRule;
use App\Models\Invoice;
use App\Models\Promotion;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Services\PaymentService;
use App\Services\RoleCommissionService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Règles de commission attribuées aux rôles (réglages > commissions).
 */
class RoleCommissionRulesTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $this->agency = Agency::factory()->create();
        $this->admin = $this->userWithRole('super-admin');
    }

    private function userWithRole(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    private function commercialUser(): User
    {
        $user = $this->userWithRole('commercial');
        Commercial::factory()->create(['user_id' => $user->id, 'agency_id' => $this->agency->id]);

        return $user->fresh();
    }

    private function rule(array $attributes, array $roles): CommissionRule
    {
        $rule = CommissionRule::create($attributes + [
            'rule_group_id' => (string) Str::uuid(),
            'version' => 1,
            'trigger_event' => CommissionRule::TRIGGER_ON_PAYMENT,
            'formula_type' => CommissionRule::FORMULA_PERCENT,
            'is_active' => true,
            'created_by' => $this->admin->id,
        ]);
        $rule->roles()->sync(Role::whereIn('name', $roles)->pluck('id'));

        return $rule;
    }

    private function invoiceFor(User $seller, float $total, array $lines, array $extra = []): Invoice
    {
        $invoice = Invoice::create($extra + [
            'number' => 'FAC-'.uniqid(),
            'agency_id' => $this->agency->id,
            'client_id' => $this->userWithRole('client')->id,
            'seller_user_id' => $seller->id,
            'commercial_id' => $seller->commercialProfile?->id,
            'invoice_date' => now()->toDateString(),
            'payment_type' => 'cash',
            'total_amount' => $total,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => 'validated',
        ]);

        foreach ($lines as $line) {
            $invoice->items()->create($line + ['quantity' => 1, 'line_total' => $line['unit_price']]);
        }

        return $invoice;
    }

    public function test_role_rule_uses_promotional_price_and_replaces_default_rate(): void
    {
        $seller = $this->commercialUser();
        $service = Service::factory()->create(['price' => 8000]);
        Promotion::create([
            'service_id' => $service->id,
            'type' => 'amount',
            'promo_price' => 6000,
            'start_date' => now()->startOfDay(),
            // Promotion qui se termine aujourd'hui : encore valable toute la journée.
            'end_date' => now()->startOfDay(),
        ]);

        $this->assertSame(6000.0, (float) $service->fresh()->effective_price);

        $this->rule(['name' => 'Commercial 10 %', 'basis' => 'sale', 'percent_value' => 10], ['commercial']);

        // Le formulaire envoie le prix normal (catalogue chargé avant la promo) :
        // le serveur applique le prix promotionnel.
        Sanctum::actingAs($this->admin);
        $response = $this->postJson('/api/invoices', [
            'agency_id' => $this->agency->id,
            'client_id' => $this->userWithRole('client')->id,
            'commercial_id' => $seller->commercialProfile->id,
            'seller_user_id' => $seller->id,
            'payment_type' => 'cash',
            'advance' => 6000,
            'items' => [['service_id' => $service->id, 'unit_price' => 8000, 'quantity' => 1]],
        ])->assertCreated();

        $invoice = Invoice::findOrFail($response->json('id') ?? $response->json('data.id'));
        $this->assertSame(6000.0, (float) $invoice->total_amount);

        $entries = CommissionEntry::where('invoice_id', $invoice->id)->get();
        $this->assertCount(1, $entries, 'Le taux par défaut (20 %) ne doit pas s\'ajouter à la règle du rôle.');
        $this->assertSame(600.0, (float) $entries->first()->amount);
        $this->assertSame($seller->id, $entries->first()->beneficiary_user_id);
    }

    public function test_monthly_revenue_tiers_with_recovery_condition(): void
    {
        $seller = $this->commercialUser();
        $this->rule([
            'name' => 'Paliers commerciaux',
            'basis' => 'monthly_revenue',
            'formula_type' => CommissionRule::FORMULA_TIERED,
            'min_recovery_rate' => 80,
            'tiers_json' => [
                ['min' => 1000000, 'percent' => 0.5],
                ['min' => 2000000, 'percent' => 1],
                ['min' => 4000000, 'percent' => 2, 'fixed_bonus' => 50000, 'bonus_requires_recovery' => true],
            ],
        ], ['commercial']);

        $period = now()->subMonth();
        $invoice = $this->invoiceFor($seller, 4200000, [['label' => 'Vente', 'unit_price' => 4200000]], ['invoice_date' => $period->toDateString()]);
        $invoice->payments()->create(['amount' => 4200000, 'payment_method' => 'cash', 'is_advance' => false, 'paid_at' => $period, 'received_by' => $this->admin->id]);

        // Pas de factures le mois précédent : recouvrement inconnu → bonus non acquis.
        $service = app(RoleCommissionService::class);
        $service->computePeriod($period->format('Y-m'));
        $entry = CommissionEntry::where('beneficiary_user_id', $seller->id)->where('period', $period->format('Y-m'))->firstOrFail();
        $this->assertSame(84000.0, (float) $entry->amount);

        // Mois précédent recouvré à 90 % : le bonus de 50 000 s'ajoute (recalcul).
        $this->invoiceFor($seller, 100000, [['label' => 'Vente', 'unit_price' => 100000]], [
            'invoice_date' => $period->copy()->subMonth()->toDateString(),
            'amount_paid' => 90000,
        ]);
        $service->computePeriod($period->format('Y-m'));
        $this->assertSame(134000.0, (float) $entry->fresh()->amount);
    }

    public function test_role_rules_are_not_applied_by_legacy_engine(): void
    {
        $seller = $this->commercialUser();
        // Règle attribuée au rôle caissier seulement : le commercial vendeur ne doit
        // pas la recevoir via l'ancien moteur (bénéficiaire = commercial de la facture).
        $this->rule(['name' => 'Caisse 1 %', 'basis' => 'sale', 'percent_value' => 1], ['caissier']);

        $invoice = $this->invoiceFor($seller, 10000, [['label' => 'Vente', 'unit_price' => 10000]]);
        app(PaymentService::class)->applyPayment($invoice, 10000, 'cash', false, $this->admin->id);

        $this->assertSame(0, CommissionEntry::where('invoice_id', $invoice->id)->whereNotNull('commission_rule_id')->count());
    }

    public function test_target_kind_covers_every_line_of_that_kind(): void
    {
        $seller = $this->commercialUser();
        // « Tous les produits » : aucun produit précis choisi.
        $this->rule(['name' => 'Produits 10 %', 'basis' => 'sale', 'target_kind' => 'product', 'percent_value' => 10], ['commercial']);

        $productA = \App\Models\Product::factory()->create(['selling_price' => 8000]);
        $productB = \App\Models\Product::factory()->create(['selling_price' => 2000]);
        $service = Service::factory()->create(['price' => 50000]);

        $invoice = $this->invoiceFor($seller, 60000, [
            ['product_id' => $productA->id, 'label' => 'A', 'unit_price' => 8000],
            ['product_id' => $productB->id, 'label' => 'B', 'unit_price' => 2000],
            ['service_id' => $service->id, 'label' => 'S', 'unit_price' => 50000],
        ]);
        app(PaymentService::class)->applyPayment($invoice, 60000, 'cash', false, $this->admin->id);

        $entry = CommissionEntry::where('invoice_id', $invoice->id)->whereNotNull('commission_rule_id')->sole();
        $this->assertSame(10000.0, (float) $entry->base_amount, 'Seules les lignes produit forment la base.');
        $this->assertSame(1000.0, (float) $entry->amount);
    }

    /**
     * Chaîne de contrats : souscription (renewal_count 0) puis renouvellements.
     * Retourne les identifiants, du plus ancien au plus récent.
     *
     * @return array<int, string>
     */
    private function contractChain(int $renewals, string $clientId, ?string $parentEnd = null): array
    {
        $ids = [];
        $parent = null;
        for ($n = 0; $n <= $renewals; $n++) {
            $id = (string) Str::uuid();
            \DB::table('contracts')->insert([
                'id' => $id,
                'number' => 'CTR-'.uniqid(),
                'client_id' => $clientId,
                'agency_id' => $this->agency->id,
                'start_date' => now()->subMonths($renewals - $n + 1)->toDateString(),
                'end_date' => $n === $renewals - 1 && $parentEnd ? $parentEnd : now()->subMonths($renewals - $n)->toDateString(),
                'billing_cycle' => 'monthly',
                'amount' => 10000,
                'status' => 'active',
                'auto_renew' => false,
                'renewal_count' => $n,
                'parent_contract_id' => $parent,
                'origin' => 'package',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $ids[] = $id;
            $parent = $id;
        }

        return $ids;
    }

    /** Prestation (avec un équipier ayant un compte) rattachée à un contrat. */
    private function prestationWithTeam(string $contractId, string $clientId, User $member): void
    {
        $prestationId = (string) Str::uuid();
        \DB::table('prestations')->insert([
            'id' => $prestationId,
            'reference' => 'PRS-'.uniqid(),
            'agency_id' => $this->agency->id,
            'name' => 'Community management',
            'client_id' => $clientId,
            'contract_id' => $contractId,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addMonth()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        \DB::table('prestation_team_members')->insert([
            'id' => (string) Str::uuid(),
            'prestation_id' => $prestationId,
            'user_id' => $member->id,
            'is_lead' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function payRenewal(User $seller, string $contractId): Invoice
    {
        $invoice = $this->invoiceFor($seller, 10000, [['label' => 'Package', 'unit_price' => 10000]], ['contract_id' => $contractId]);
        app(PaymentService::class)->applyPayment($invoice, 10000, 'cash', false, $this->admin->id);

        return $invoice;
    }

    private function ruleAmount(Invoice $invoice, User $beneficiary): float
    {
        return (float) CommissionEntry::where('invoice_id', $invoice->id)->where('beneficiary_user_id', $beneficiary->id)->sum('amount');
    }

    public function test_renewal_rules_target_the_nth_renewal_without_stacking(): void
    {
        $seller = $this->commercialUser();
        $cm = $this->userWithRole('community-manager');
        $client = $this->userWithRole('client');
        $this->rule(['name' => 'CM 2 % chaque renouvellement', 'basis' => 'renewal', 'percent_value' => 2], ['community-manager']);
        $this->rule(['name' => 'CM 5 % 3e renouvellement', 'basis' => 'renewal', 'renewal_number' => 3, 'percent_value' => 5], ['community-manager']);

        // Équipe sur la souscription d'origine uniquement : retrouvée en remontant
        // la chaîne des renouvellements.
        $chain = $this->contractChain(3, $client->id);
        $this->prestationWithTeam($chain[0], $client->id, $cm);

        $this->assertSame(200.0, $this->ruleAmount($this->payRenewal($seller, $chain[1]), $cm), '1er renouvellement : 2 %');
        $this->assertSame(200.0, $this->ruleAmount($this->payRenewal($seller, $chain[2]), $cm), '2e renouvellement : 2 %');
        $this->assertSame(500.0, $this->ruleAmount($this->payRenewal($seller, $chain[3]), $cm), '3e renouvellement : 5 % (pas 2 % + 5 %)');
        $this->assertSame(0.0, $this->ruleAmount($this->payRenewal($seller, $chain[0]), $cm), 'Souscription initiale : pas un renouvellement');
    }

    public function test_on_time_renewal_requires_payment_before_previous_period_end(): void
    {
        $seller = $this->commercialUser();
        $client = $this->userWithRole('client');
        $chief = $this->userWithRole('responsable-agence');
        $chief->assignments()->sync([$this->agency->id => ['is_primary' => true]]);
        $this->rule(['name' => 'À date', 'basis' => 'renewal', 'renewal_on_time' => true, 'percent_value' => 10], ['responsable-agence']);

        // Période précédente terminée hier : renouvellement payé en retard.
        $late = $this->contractChain(1, $client->id, now()->subDay()->toDateString());
        $this->assertSame(0.0, $this->ruleAmount($this->payRenewal($seller, $late[1]), $chief));

        // Période précédente se terminant dans 5 jours : payé à date.
        $onTime = $this->contractChain(1, $client->id, now()->addDays(5)->toDateString());
        $this->assertSame(1000.0, $this->ruleAmount($this->payRenewal($seller, $onTime[1]), $chief));
    }

    public function test_default_rate_no_longer_applies_once_role_has_rules(): void
    {
        $seller = $this->commercialUser();
        $invoice = $this->invoiceFor($seller, 10000, [['label' => 'Vente', 'unit_price' => 10000]]);
        app(PaymentService::class)->applyPayment($invoice, 10000, 'cash', false, $this->admin->id);
        $this->assertGreaterThan(0, CommissionEntry::where('invoice_id', $invoice->id)->sum('amount'), 'Sans règle : taux par défaut.');

        // Rôle commercial rémunéré par paliers mensuels : plus de taux par vente.
        $this->rule(['name' => 'Paliers', 'basis' => 'monthly_revenue', 'formula_type' => 'tiered', 'tiers_json' => [['min' => 1000000, 'percent' => 0.5]]], ['commercial']);
        $second = $this->invoiceFor($seller, 10000, [['label' => 'Vente', 'unit_price' => 10000]]);
        app(PaymentService::class)->applyPayment($second, 10000, 'cash', false, $this->admin->id);
        $this->assertSame(0.0, (float) CommissionEntry::where('invoice_id', $second->id)->sum('amount'));
    }

    public function test_default_rules_seeder_creates_the_grid(): void
    {
        $this->seed(\Database\Seeders\DefaultCommissionRulesSeeder::class);

        $this->assertSame(18, CommissionRule::count());
        $tiers = CommissionRule::where('name', 'Commerciaux — paliers CA mensuel')->firstOrFail();
        $this->assertTrue($tiers->is_active);
        $this->assertTrue($tiers->roles()->where('name', 'commercial')->exists());
        $this->assertFalse(CommissionRule::where('name', 'like', 'Chefs d%')->firstOrFail()->is_active, 'Paliers à préciser : inactive.');

        // Relancer ne duplique rien.
        $this->seed(\Database\Seeders\DefaultCommissionRulesSeeder::class);
        $this->assertSame(18, CommissionRule::count());
    }

    public function test_only_validator_roles_can_hold_invoice_validation(): void
    {
        $validate = \App\Models\Permission::where('name', 'invoices.valider')->value('id');
        $consult = \App\Models\Permission::where('name', 'invoices.consulter')->value('id');
        $agencyChief = Role::where('name', 'responsable-agence')->firstOrFail();

        Sanctum::actingAs($this->admin);
        $this->putJson("/api/roles/{$agencyChief->id}/permissions", ['permissions' => [$validate, $consult]])->assertOk();

        $names = $agencyChief->fresh()->permissions()->pluck('name')->all();
        $this->assertContains('invoices.consulter', $names);
        $this->assertNotContains('invoices.valider', $names);
    }

    public function test_only_super_admin_can_compute_monthly_bonuses(): void
    {
        $period = now()->subMonth()->format('Y-m');

        Sanctum::actingAs($this->userWithRole('direction-generale'));
        $this->postJson('/api/commission-rules/compute-period', ['period' => $period])->assertForbidden();

        Sanctum::actingAs($this->admin);
        $this->postJson('/api/commission-rules/compute-period', ['period' => $period])
            ->assertOk()
            ->assertJsonStructure(['data' => ['created', 'updated', 'rows']]);
    }
}
