<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase8SeminarTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class, AccountingCategorySeeder::class]);
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function createCategory(): array
    {
        return $this->postJson('/api/categories', ['name' => 'Séminaire'])
            ->assertStatus(201)
            ->json();
    }

    private function createAgency(): array
    {
        return $this->postJson('/api/agencies', [
            'name' => 'Agence Douala',
            'code' => 'DLA',
            'country' => 'Cameroun',
            'city' => 'Douala',
        ])->assertStatus(201)->json();
    }

    private function createSeminarService(array $attributes = []): array
    {
        $category = $this->createCategory();
        $agency = $this->createAgency();

        return $this->postJson('/api/services', array_merge([
            'agency_id' => $agency['id'],
            'category_id' => $category['id'],
            'name' => 'Séminaire Leadership',
            'price' => 20000,
            'is_seminar' => true,
        ], $attributes))->assertStatus(201)->json();
    }

    public function test_seminar_service_derives_default_tiers(): void
    {
        $this->actingAsAdmin();

        $service = $this->createSeminarService();

        $this->assertTrue($service['is_seminar']);

        $tiers = collect($service['seminar_tiers'])->keyBy('tier');
        $this->assertCount(3, $tiers);
        $this->assertEquals('20000.00', $tiers['classique']['price']);
        $this->assertEquals('30000.00', $tiers['premium']['price']);
        $this->assertEquals('50000.00', $tiers['vip']['price']);
        $this->assertSame('Pass Classique', $tiers['classique']['label']);
    }

    public function test_seminar_service_accepts_custom_tiers(): void
    {
        $this->actingAsAdmin();

        $service = $this->createSeminarService([
            'tiers' => [
                ['tier' => 'classique', 'label' => 'Pass Classique', 'price' => 15000],
                ['tier' => 'premium', 'label' => 'Pass Premium', 'price' => 25000],
                ['tier' => 'vip', 'label' => 'Pass VIP', 'price' => 45000, 'description' => 'Accès complet'],
            ],
        ]);

        $tiers = collect($service['seminar_tiers'])->keyBy('tier');
        $this->assertEquals('15000.00', $tiers['classique']['price']);
        $this->assertEquals('45000.00', $tiers['vip']['price']);
        $this->assertSame('Accès complet', $tiers['vip']['description']);
    }

    public function test_seminar_update_removes_tiers_when_disabled(): void
    {
        $this->actingAsAdmin();

        $service = $this->createSeminarService();

        $updated = $this->putJson("/api/services/{$service['id']}", ['is_seminar' => false])
            ->assertOk()
            ->json();

        $this->assertFalse($updated['is_seminar']);
        $this->assertDatabaseMissing('seminar_tiers', ['service_id' => $service['id']]);
    }

    public function test_invoice_with_seminar_pass_resolves_price_and_trace(): void
    {
        $this->actingAsAdmin();

        $service = $this->createSeminarService();

        $invoice = $this->postJson('/api/invoices', [
            'items' => [
                [
                    'service_id' => $service['id'],
                    'pass_tier' => 'premium',
                    'quantity' => 2,
                ],
            ],
        ])->assertStatus(201)->json();

        $this->assertCount(1, $invoice['items']);
        $item = $invoice['items'][0];
        $this->assertEquals(30000, $item['unit_price']);
        $this->assertEquals(60000, $item['line_total']);
        $this->assertSame('premium', $item['pass_tier']);
        $this->assertSame('Pass Premium', $item['pass_label']);
        $this->assertEquals(60000, $invoice['total_amount']);
    }

    public function test_invoice_pass_requires_seminar_service(): void
    {
        $this->actingAsAdmin();

        $category = $this->createCategory();
        $agency = $this->createAgency();

        $normal = $this->postJson('/api/services', [
            'agency_id' => $agency['id'],
            'category_id' => $category['id'],
            'name' => 'Formation Excel',
            'price' => 10000,
        ])->assertStatus(201)->json();

        $this->postJson('/api/invoices', [
            'items' => [
                ['service_id' => $normal['id'], 'pass_tier' => 'vip', 'quantity' => 1],
            ],
        ])->assertStatus(422);

        $this->postJson('/api/invoices', [
            'items' => [
                ['label' => 'Libre', 'unit_price' => 5000, 'pass_tier' => 'classique', 'quantity' => 1],
            ],
        ])->assertStatus(422);

        $service = $this->createSeminarService();

        $this->postJson('/api/invoices', [
            'items' => [
                ['service_id' => $service['id'], 'pass_tier' => 'gold', 'quantity' => 1],
            ],
        ])->assertStatus(422);
    }
}
