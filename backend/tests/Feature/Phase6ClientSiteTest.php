<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\FormationEnrollment;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\TrainingSession;
use App\Models\User;
use Database\Seeders\ClientCategorySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Contrats consommés par le site client frontend_client/ — Phase 6 du plan.
 * Ces tests verrouillent la forme exacte des réponses déjà alignée sur
 * src/api/* et src/types/index.ts (course.name, learner-profile, etc.).
 */
class Phase6ClientSiteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            ClientCategorySeeder::class,
        ]);
    }

    private function registerAndLogin(): string
    {
        $this->postJson('/api/client/register', [
            'first_name' => 'Claire',
            'last_name' => 'Client',
            'email' => 'claire@example.com',
            'phone' => '+237690000000',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertStatus(201)->assertJsonPath('message', 'Compte créé avec succès.');

        return $this->postJson('/api/client/login', [
            'email' => 'claire@example.com',
            'password' => 'password123',
        ])->assertOk()->json('token');
    }

    public function test_register_returns_message_without_token_then_login_provides_one(): void
    {
        $response = $this->postJson('/api/client/register', [
            'first_name' => 'Claire',
            'last_name' => 'Client',
            'email' => 'claire@example.com',
            'phone' => '+237690000000',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertStatus(201)->json();

        // Le front fait un auto-login après inscription : aucun token dans la réponse.
        $this->assertArrayHasKey('message', $response);
        $this->assertArrayNotHasKey('token', $response);

        $login = $this->postJson('/api/client/login', [
            'email' => 'claire@example.com',
            'password' => 'password123',
        ])->assertOk()->json();

        $this->assertArrayHasKey('user', $login);
        $this->assertArrayHasKey('token', $login);
        $this->assertSame('Claire Client', $login['user']['name']);
    }

    public function test_me_returns_user_resource_with_full_name(): void
    {
        $token = $this->registerAndLogin();

        $me = $this->withToken($token)->getJson('/api/client/me')->assertOk()->json();

        $this->assertSame('Claire Client', $me['name']);
        $this->assertSame('Claire', $me['first_name']);
        $this->assertSame('claire@example.com', $me['email']);
        $this->assertSame('+237690000000', $me['phone']);
    }

    public function test_checkout_with_catalog_lines_returns_order_and_pending_invoice(): void
    {
        $token = $this->registerAndLogin();
        $service = Service::factory()->create(['price' => 10000]);

        $result = $this->withToken($token)
            ->postJson('/api/client/checkout', [
                'agency_id' => Agency::factory()->create()->id,
                'lines' => [
                    ['line_type' => 'catalog', 'service_id' => $service->id, 'quantity' => 2],
                ],
            ])
            ->assertStatus(201)
            ->json();

        $this->assertArrayHasKey('order', $result);
        $this->assertArrayHasKey('invoice', $result);
        $this->assertSame('completed', $result['order']['status']);
        $this->assertSame('client_self', $result['order']['channel']);
        $this->assertSame('pending', $result['invoice']['validation_status']);
        $this->assertSame('client_self', $result['invoice']['source']);
        $this->assertEquals(20000, $result['invoice']['total_amount']);
    }

    public function test_checkout_accepts_multiple_lines_with_service_and_product(): void
    {
        $token = $this->registerAndLogin();
        $service = Service::factory()->create(['price' => 10000]);
        $product = Product::factory()->create(['selling_price' => 5000, 'is_public' => true]);

        $result = $this->withToken($token)
            ->postJson('/api/client/checkout', [
                'agency_id' => Agency::factory()->create()->id,
                'lines' => [
                    ['line_type' => 'catalog', 'service_id' => $service->id, 'quantity' => 2],
                    ['line_type' => 'catalog', 'product_id' => $product->id, 'quantity' => 3],
                ],
            ])
            ->assertStatus(201)
            ->json();

        // Panier multi-articles : total = 10000x2 + 5000x3.
        $this->assertEquals(35000, $result['invoice']['total_amount']);

        $lines = collect($result['order']['lines']);
        $serviceLine = $lines->firstWhere('service_id', $service->id);
        $productLine = $lines->firstWhere('product_id', $product->id);
        $this->assertNotNull($serviceLine);
        $this->assertNotNull($productLine);
        $this->assertEquals(2, $serviceLine['quantity']);
        $this->assertEquals(3, $productLine['quantity']);

        // Les lignes produit doivent remonter jusqu'à la facture.
        $this->assertDatabaseHas('order_lines', ['service_id' => $service->id, 'product_id' => null]);
        $this->assertDatabaseHas('order_lines', ['product_id' => $product->id]);
        $this->assertDatabaseHas('invoice_items', [
            'invoice_id' => $result['invoice']['id'],
            'product_id' => $product->id,
        ]);
    }

    public function test_checkout_catalog_line_without_service_or_product_is_rejected(): void
    {
        $token = $this->registerAndLogin();

        $this->withToken($token)
            ->postJson('/api/client/checkout', [
                'agency_id' => Agency::factory()->create()->id,
                'lines' => [
                    ['line_type' => 'catalog', 'quantity' => 1],
                ],
            ])
            ->assertStatus(422);

        $this->withToken($token)
            ->postJson('/api/client/checkout', [
                'agency_id' => Agency::factory()->create()->id,
                'lines' => [
                    ['line_type' => 'catalog', 'service_id' => Service::factory()->create()->id, 'product_id' => Product::factory()->create()->id, 'quantity' => 1],
                ],
            ])
            ->assertStatus(422);
    }

    public function test_enrollments_expose_course_name_not_title(): void
    {
        $token = $this->registerAndLogin();
        $course = Course::factory()->create([
            'name' => 'Formation Excel',
            'code' => 'F-EXCEL',
            'duration_hours' => 12,
        ]);

        FormationEnrollment::create([
            'course_id' => $course->id,
            'learner_user_id' => User::where('email', 'claire@example.com')->firstOrFail()->id,
            'enrolled_at' => now(),
            'status' => 'active',
        ]);

        $enrollments = $this->withToken($token)
            ->getJson('/api/client/enrollments')
            ->assertOk()
            ->json();

        $this->assertCount(1, $enrollments['data']);
        $apiCourse = $enrollments['data'][0]['course'];
        $this->assertSame('Formation Excel', $apiCourse['name']);
        $this->assertSame('F-EXCEL', $apiCourse['code']);
        $this->assertSame(12, $apiCourse['duration_hours']);
        // Le frontend consomme course.name : un champ `title` serait un break de contrat.
        $this->assertArrayNotHasKey('title', $apiCourse);
    }

    public function test_learner_profile_returns_profile_and_courses_with_module_presences(): void
    {
        $token = $this->registerAndLogin();
        $user = User::where('email', 'claire@example.com')->firstOrFail();

        $course = Course::factory()->create(['name' => 'Formation Excel']);
        $module = CourseModule::create([
            'course_id' => $course->id,
            'name' => 'Module 1',
            'order_index' => 1,
        ]);
        $session = TrainingSession::factory()->create(['course_id' => $course->id]);

        FormationEnrollment::create([
            'course_id' => $course->id,
            'learner_user_id' => $user->id,
            'enrolled_at' => now(),
            'status' => 'active',
        ]);

        Attendance::create([
            'training_session_id' => $session->id,
            'learner_user_id' => $user->id,
            'course_module_id' => $module->id,
            'status' => Attendance::STATUS_PRESENT,
            'recorded_at' => now(),
        ]);

        $profile = $this->withToken($token)->getJson('/api/client/learner-profile')->assertOk()->json();

        $this->assertSame($user->email, $profile['profile']['email']);
        $this->assertSame('Claire', $profile['profile']['first_name']);

        $firstCourse = $profile['courses'][0];
        $this->assertSame('Formation Excel', $firstCourse['course']['name']);
        $this->assertSame('active', $firstCourse['status']);

        $firstModule = $firstCourse['modules'][0];
        $this->assertSame('Module 1', $firstModule['name']);
        $this->assertSame(['present' => 1, 'absent' => 0, 'recorded' => 1], $firstModule['presences']);
    }

    public function test_observation_store_with_course_module_id_is_visible(): void
    {
        $token = $this->registerAndLogin();
        $course = Course::factory()->create(['name' => 'Formation Excel']);
        $module = CourseModule::create([
            'course_id' => $course->id,
            'name' => 'Module 1',
            'order_index' => 1,
        ]);

        $observation = $this->withToken($token)
            ->postJson('/api/client/observations', [
                'course_id' => $course->id,
                'course_module_id' => $module->id,
                'content' => 'J\'ai bien compris ce module.',
            ])
            ->assertStatus(201)
            ->json();

        $this->assertSame(true, $observation['visible_to_client']);
        $this->assertSame('J\'ai bien compris ce module.', $observation['content']);
        $this->assertSame('Module 1', $observation['course_module']['name']);

        $list = $this->withToken($token)->getJson('/api/client/observations')->assertOk()->json();
        $this->assertCount(1, $list['data']);
    }
}