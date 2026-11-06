<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Support\ApiCache;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Cache des réponses de l'API (middleware cache.response + InvalidateApiCache).
 * Désactivé par défaut dans phpunit.xml, activé ici.
 */
class ApiResponseCacheTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.api_responses' => true]);
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    public function test_stats_are_served_from_cache_until_a_write_happens(): void
    {
        Sanctum::actingAs($this->user('super-admin'));

        $this->getJson('/api/stats/overview')->assertOk()->assertHeader('X-Cache', 'MISS');
        $this->getJson('/api/stats/overview')->assertOk()->assertHeader('X-Cache', 'HIT');

        // Une écriture quelconque (ici une catégorie de formation) invalide les statistiques.
        $this->postJson('/api/course-categories', ['name' => 'Bureautique'])->assertCreated();

        $this->getJson('/api/stats/overview')->assertOk()->assertHeader('X-Cache', 'MISS');
    }

    public function test_failed_write_and_neutral_paths_do_not_invalidate(): void
    {
        Sanctum::actingAs($this->user('super-admin'));
        $version = ApiCache::version(ApiCache::DATA);

        // Écriture refusée (validation) : rien n'a changé en base.
        $this->postJson('/api/course-categories', [])->assertStatus(422);
        // Connexion échouée / déconnexion : neutres.
        $this->postJson('/api/auth/login', ['email' => 'x@example.com', 'password' => 'nope']);

        $this->assertSame($version, ApiCache::version(ApiCache::DATA));
    }

    public function test_cached_response_is_never_shared_between_users(): void
    {
        $first = $this->user('super-admin');
        $second = $this->user('super-admin');

        Sanctum::actingAs($first);
        $this->getJson('/api/stats/overview')->assertHeader('X-Cache', 'MISS');

        Sanctum::actingAs($second);
        $this->getJson('/api/stats/overview')->assertHeader('X-Cache', 'MISS');
        $this->getJson('/api/stats/overview')->assertHeader('X-Cache', 'HIT');
    }

    public function test_permission_is_checked_before_the_cache(): void
    {
        Sanctum::actingAs($this->user('super-admin'));
        $this->getJson('/api/stats/overview')->assertOk();

        // Un rôle sans stats.consulter reste refusé, cache ou pas.
        Sanctum::actingAs($this->user('formateur'));
        $this->getJson('/api/stats/overview')->assertForbidden();
    }

    public function test_reference_lists_are_invalidated_only_by_reference_writes(): void
    {
        Sanctum::actingAs($this->user('super-admin'));

        $this->getJson('/api/course-categories')->assertOk()->assertHeader('X-Cache', 'MISS');
        $this->getJson('/api/course-categories')->assertHeader('X-Cache', 'HIT');

        // Écriture hors référentiel (ex. une dépense) : la liste reste en cache.
        $referenceVersion = ApiCache::version(ApiCache::REFERENCE);
        ApiCache::bump(ApiCache::DATA);
        $this->assertSame($referenceVersion, ApiCache::version(ApiCache::REFERENCE));
        $this->getJson('/api/course-categories')->assertHeader('X-Cache', 'HIT');

        // Nouvelle catégorie : la liste est recalculée et la contient.
        $this->postJson('/api/course-categories', ['name' => 'Marketing digital'])->assertCreated();
        $this->getJson('/api/course-categories')
            ->assertHeader('X-Cache', 'MISS')
            ->assertJsonFragment(['name' => 'Marketing digital']);
    }

    public function test_client_can_force_a_fresh_response(): void
    {
        Sanctum::actingAs($this->user('super-admin'));

        $this->getJson('/api/stats/overview')->assertHeader('X-Cache', 'MISS');
        $this->getJson('/api/stats/overview', ['Cache-Control' => 'no-cache'])->assertHeader('X-Cache', 'MISS');
    }
}
