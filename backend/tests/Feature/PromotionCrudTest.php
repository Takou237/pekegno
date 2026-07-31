<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PromotionCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::create(['name' => 'super-admin']);
        $this->admin = User::create([
            'username' => 'admin',
            'email' => 'admin@test.com',
            'password' => 'password',
            'first_name' => 'Admin',
            'last_name' => 'Test',
            'role_id' => $role->id,
            'is_active' => true,
        ]);

        $agency = Agency::create([
            'code' => 'AG-001',
            'name' => 'Agence Douala',
            'country' => 'Cameroun',
        ]);

        $this->service = Service::create([
            'name' => 'Formation Marketing Digital',
            'category_id' => Category::create(['name' => 'Formation'])->id,
            'price' => 250000,
            'agency_id' => $agency->id,
        ]);
    }

    private function validPromotionData(): array
    {
        return [
            'promotional_price' => 200000,
            'start_date' => Carbon::now()->subDays(1)->toDateTimeString(),
            'end_date' => Carbon::now()->addDays(10)->toDateTimeString(),
        ];
    }

    public function test_can_list_promotions_for_service(): void
    {
        Sanctum::actingAs($this->admin);

        $this->service->promotions()->create($this->validPromotionData());

        $response = $this->getJson("/api/services/{$this->service->id}/promotions");

        $response->assertOk()
            ->assertJsonCount(1);
    }

    public function test_can_create_promotion(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson(
            "/api/services/{$this->service->id}/promotions",
            $this->validPromotionData()
        );

        $response->assertCreated()
            ->assertJsonFragment(['promotional_price' => '200000.00']);

        $this->assertDatabaseHas('promotions', [
            'service_id' => $this->service->id,
            'promotional_price' => '200000.00',
        ]);
    }

    public function test_cannot_create_promotion_with_end_before_start(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson(
            "/api/services/{$this->service->id}/promotions",
            [
                'promotional_price' => 100000,
                'start_date' => Carbon::now()->addDays(5)->toDateTimeString(),
                'end_date' => Carbon::now()->toDateTimeString(),
            ]
        );

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['end_date']);
    }

    public function test_cannot_create_promotion_without_required_fields(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson("/api/services/{$this->service->id}/promotions", []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['promotional_price', 'start_date', 'end_date']);
    }

    public function test_can_update_promotion(): void
    {
        Sanctum::actingAs($this->admin);

        $promotion = $this->service->promotions()->create($this->validPromotionData());

        $response = $this->putJson("/api/promotions/{$promotion->id}", [
            'promotional_price' => 180000,
        ]);

        $response->assertOk()
            ->assertJsonFragment(['promotional_price' => '180000.00']);

        $this->assertDatabaseHas('promotions', [
            'id' => $promotion->id,
            'promotional_price' => '180000.00',
        ]);
    }

    public function test_can_deactivate_promotion(): void
    {
        Sanctum::actingAs($this->admin);

        $promotion = $this->service->promotions()->create($this->validPromotionData());

        $response = $this->putJson("/api/promotions/{$promotion->id}", [
            'is_active' => false,
        ]);

        $response->assertOk()
            ->assertJsonFragment(['is_active' => false]);
    }

    public function test_can_delete_promotion(): void
    {
        Sanctum::actingAs($this->admin);

        $promotion = $this->service->promotions()->create($this->validPromotionData());

        $response = $this->deleteJson("/api/promotions/{$promotion->id}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('promotions', ['id' => $promotion->id]);
    }

    public function test_can_list_all_promotions_with_filter(): void
    {
        Sanctum::actingAs($this->admin);

        $this->service->promotions()->create($this->validPromotionData());
        $this->service->promotions()->create(array_merge($this->validPromotionData(), [
            'is_active' => false,
        ]));

        $response = $this->getJson('/api/promotions?status=active');

        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
