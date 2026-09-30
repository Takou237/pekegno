<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Country;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
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

        $invoice = $this->post('/api/invoices', [
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
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

        $invoice = $this->post('/api/invoices', [
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertStatus(201)->json();

        // Le caissier accepte d'abord la preuve (→ validation automatique),
        // puis peut encaisser.
        $proof = PaymentProof::where('invoice_id', $invoice['id'])->first();
        $this->actingAsRole('caissier');
        $this->postJson("/api/payment-proofs/{$proof->id}/approve")->assertOk();

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice['id'],
            'validation_status' => Invoice::VALIDATION_VALIDATED,
        ]);

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
        $invoice = $this->post('/api/invoices', [
            'agency_id' => $agency->id,
            'items' => [
                ['label' => 'Massage', 'unit_price' => 10000, 'quantity' => 2],
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 3],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
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
        $proof = PaymentProof::where('invoice_id', $invoice['id'])->first();
        $this->postJson("/api/payment-proofs/{$proof->id}/approve")->assertOk();
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

    public function test_commercial_sale_requires_proof_file_at_creation(): void
    {
        $this->createCommercialUser();
        Sanctum::actingAs($this->createCommercialUser());

        // Sans preuve de paiement, la création de la facture est refusée.
        $this->postJson('/api/invoices', [
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ])->assertStatus(422);
    }

    public function test_cashier_sale_does_not_require_proof_file(): void
    {
        $this->actingAsRole('caissier');

        // Le caissier vend au guichet sans preuve : création directe, validée.
        $this->postJson('/api/invoices', [
            'items' => [
                ['label' => 'Vente guichet', 'unit_price' => 8000, 'quantity' => 1],
            ],
        ])->assertStatus(201);
    }

    public function test_commercial_can_attach_digital_payment_proof_at_creation(): void
    {
        $commercial = $this->createCommercialUser();
        Sanctum::actingAs($commercial);

        $invoice = $this->post('/api/invoices', [
            'payment_type' => 'om',
            'payer_phone' => '+237690000000',
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertStatus(201)->json();

        $this->assertSame(Invoice::VALIDATION_PENDING, $invoice['validation_status']);

        $proof = PaymentProof::where('invoice_id', $invoice['id'])->first();
        $this->assertNotNull($proof);
        $this->assertSame(PaymentProof::STATUS_PENDING, $proof->status);
        $this->assertSame($commercial->id, $proof->submitted_by);
        $this->assertSame('om', $proof->payment_method);
        $this->assertNotNull($proof->file_path);

        // Le caissier ne peut pas valider tant que la preuve n'a pas été acceptée.
        $this->actingAsRole('caissier');
        $this->postJson("/api/invoices/{$invoice['id']}/validate")
            ->assertStatus(422);
    }

    public function test_cashier_accepting_proof_validates_invoice_automatically(): void
    {
        $commercial = $this->createCommercialUser();
        Sanctum::actingAs($commercial);

        $invoice = $this->post('/api/invoices', [
            'payment_type' => 'om',
            'payer_phone' => '+237690000000',
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertStatus(201)->json();

        $proof = PaymentProof::where('invoice_id', $invoice['id'])->first();

        // Le caissier accepte la preuve → la facture est automatiquement validée.
        $this->actingAsRole('caissier');
        $response = $this->postJson("/api/payment-proofs/{$proof->id}/approve")
            ->assertOk()
            ->json();

        $this->assertSame(PaymentProof::STATUS_ACCEPTED, $response['proof']['status']);
        $this->assertSame(Invoice::VALIDATION_VALIDATED, $response['invoice']['validation_status']);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice['id'],
            'validation_status' => Invoice::VALIDATION_VALIDATED,
        ]);

        // Le caissier peut ensuite encaisser directement.
        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 15000,
            'payment_method' => 'cash',
        ])->assertOk();
    }

    public function test_cashier_rejecting_proof_rejects_invoice_automatically(): void
    {
        $commercial = $this->createCommercialUser();
        Sanctum::actingAs($commercial);

        $invoice = $this->post('/api/invoices', [
            'payment_type' => 'momo',
            'payer_phone' => '+237690000000',
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertStatus(201)->json();

        $proof = PaymentProof::where('invoice_id', $invoice['id'])->first();

        // Le caissier rejette la preuve → la facture est automatiquement rejetée.
        $this->actingAsRole('caissier');
        $response = $this->postJson("/api/payment-proofs/{$proof->id}/reject", [
            'notes' => 'Capture illisible.',
        ])->assertOk()
            ->json();

        $this->assertSame(PaymentProof::STATUS_REJECTED, $response['proof']['status']);
        $this->assertSame(Invoice::VALIDATION_REJECTED, $response['invoice']['validation_status']);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice['id'],
            'validation_status' => Invoice::VALIDATION_REJECTED,
        ]);
    }

    private function scopedStats(string $commercialId): array
    {
        $this->actingAsRole('super-admin');
        return $this->getJson("/api/commercials/{$commercialId}/stats")
            ->assertOk()
            ->json();
    }

    public function test_commercial_can_view_own_stats(): void
    {
        $commercial = $this->createCommercialUser();
        Sanctum::actingAs($commercial);

        $invoice = $this->post('/api/invoices', [
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertStatus(201)->json();

        // Un caissier valide puis encaisse la facture (statut paid).
        $this->actingAsRole('caissier');
        $proof = PaymentProof::where('invoice_id', $invoice['id'])->first();
        $this->postJson("/api/payment-proofs/{$proof->id}/approve")->assertOk();
        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 15000,
            'payment_method' => 'cash',
        ])->assertOk();

        Sanctum::actingAs($commercial);
        $stats = $this->getJson('/api/commercials/me/stats')
            ->assertOk()
            ->json();

        $this->assertSame($commercial->commercialProfile->id, $stats['commercial']['id']);
        $this->assertSame(15000.0, (float) $stats['turnover']);
        $this->assertSame(1, $stats['sales_count']);
        $this->assertSame($commercial->commercialProfile->points_balance, $stats['points_balance']);
        $this->assertArrayHasKey('monthly', $stats);
    }

    public function test_user_without_commercial_profile_cannot_view_own_stats(): void
    {
        $this->actingAsRole('caissier');

        $this->getJson('/api/commercials/me/stats')
            ->assertStatus(404);
    }

    /**
     * Un commercial créé via l'admin avant l'auto-création du profil métier n'a pas de
     * ligne dans `commercials`. Sa première connexion doit réparer cela : ensuite, son
     * dashboard répond et ses ventes lui sont rattachées.
     */
    public function test_login_repairs_missing_commercial_profile(): void
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
            'email' => 'thibault.noupoue@example.com',
            'password' => bcrypt('12345678'),
        ]);

        $this->assertNull(Commercial::where('user_id', $user->id)->first());

        $this->postJson('/api/staff/login', [
            'email' => 'thibault.noupoue@example.com',
            'password' => '12345678',
        ])->assertOk();

        $this->assertNotNull(Commercial::where('user_id', $user->id)->first(), 'Le profil commercial doit être créé à la première connexion.');
    }

    /**
     * Même sans profil métier, une commande facturée par un commercial doit naître en
     * attente de validation : la décision ne peut pas reposer sur commercial_id seul,
     * qui était null pour ces comptes — la facture échappait alors au caissier.
     */
    public function test_order_invoiced_by_commercial_without_profile_still_pending(): void
    {
        $client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);

        $commercialUser = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        Sanctum::actingAs($commercialUser);

        $order = $this->postJson('/api/orders', [
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $client->id,
            'lines' => [
                ['line_type' => 'manual', 'label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $this->postJson("/api/orders/{$order['id']}/confirm")->assertOk();

        $invoice = $this->postJson("/api/orders/{$order['id']}/invoice")
            ->assertStatus(201)
            ->json();

        $this->assertSame(
            Invoice::VALIDATION_PENDING,
            $invoice['validation_status'],
            'La facture d’un commercial sans profil doit rester en attente de validation caissier.'
        );
    }

    /**
     * La file de validation ne peut pas être bornée à la seule agence du caissier :
     * une vente d'un commercial rattaché à une autre agence du même pays resterait
     * en attente indéfiniment, invisible de tous les caissiers (et hors de portée de
     * la validation métier que le caissier a pour mission d'accomplir).
     */
    public function test_cashier_sees_pending_invoice_of_a_commercial_in_another_agency_of_same_country(): void
    {
        $country = Country::create([
            'name' => 'Cameroun',
            'code' => 'CMR',
            'currency_code' => 'XAF',
        ]);

        $cashierAgency = Agency::factory()->create(['country_id' => $country->id]);
        $commercialAgency = Agency::factory()->create(['country_id' => $country->id]);

        $cashier = $this->actingAsRole('caissier');
        DB::table('user_assignments')->insert([
            'user_id' => $cashier->id,
            'agency_id' => $cashierAgency->id,
            'is_primary' => false,
            'is_department_chief' => false,
        ]);

        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        Commercial::factory()->create([
            'user_id' => $commercial->id,
            'agency_id' => $commercialAgency->id,
        ]);

        Sanctum::actingAs($commercial);
        $invoiceId = $this->post('/api/invoices', [
            'agency_id' => $commercialAgency->id,
            'payment_type' => 'momo',
            'payer_phone' => '+237690000000',
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertCreated()->json('id');

        Sanctum::actingAs($cashier);

        $this->getJson('/api/invoices?validation_status=pending')
            ->assertOk()
            ->assertJsonPath('invoices.meta.total', 1)
            ->assertJsonPath('invoices.data.0.id', $invoiceId)
            ->assertJsonPath('invoices.data.0.payment_proofs_count', 1);
    }

    /**
     * Le clic sur « Valider » ouvre la modale d'examen de la preuve. Si la preuve
     * n'est pas dans le périmètre du caissier, la liste annonce pourtant
     * payment_proofs_count = 1 et l'écran affiche « aucune preuve à afficher » :
     * le commercial est bloqué avec un aller-retour inutile. Le périmètre des
     * preuves doit donc suivre celui de la facture qu'elles justifient.
     */
    public function test_cashier_can_read_the_proof_of_a_pending_invoice_from_another_agency(): void
    {
        $country = Country::create([
            'name' => 'Cameroun',
            'code' => 'CMR',
            'currency_code' => 'XAF',
        ]);

        $cashierAgency = Agency::factory()->create(['country_id' => $country->id]);
        $commercialAgency = Agency::factory()->create(['country_id' => $country->id]);

        $cashier = $this->actingAsRole('caissier');
        DB::table('user_assignments')->insert([
            'user_id' => $cashier->id,
            'agency_id' => $cashierAgency->id,
            'is_primary' => false,
            'is_department_chief' => false,
        ]);

        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        Commercial::factory()->create([
            'user_id' => $commercial->id,
            'agency_id' => $commercialAgency->id,
        ]);

        Sanctum::actingAs($commercial);
        $invoiceId = $this->post('/api/invoices', [
            'agency_id' => $commercialAgency->id,
            'payment_type' => 'momo',
            'payer_phone' => '+237690000000',
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertCreated()->json('id');

        Sanctum::actingAs($cashier);

        $proofId = $this->getJson("/api/payment-proofs?invoice_id={$invoiceId}&status=pending&per_page=1")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.payment_method', 'momo')
            ->json('data.0.id');

        // Et le caissier peut aller au bout : accepter la preuve valide la facture.
        $this->postJson("/api/payment-proofs/{$proofId}/approve")
            ->assertOk()
            ->assertJsonPath('invoice.validation_status', Invoice::VALIDATION_VALIDATED);
    }

    /**
     * L'élargissement au pays ne doit pas ouvrir le registre : une facture déjà
     * validée dans un autre pays reste hors périmètre du caissier.
     */
    public function test_cashier_does_not_see_validated_invoice_from_another_country(): void
    {
        $ownCountry = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF']);
        $otherCountry = Country::create(['name' => "Côte d'Ivoire", 'code' => 'CIV', 'currency_code' => 'XAF']);

        $cashierAgency = Agency::factory()->create(['country_id' => $ownCountry->id]);
        $otherAgency = Agency::factory()->create(['country_id' => $otherCountry->id]);

        $cashier = $this->actingAsRole('caissier');
        DB::table('user_assignments')->insert([
            'user_id' => $cashier->id,
            'agency_id' => $cashierAgency->id,
            'is_primary' => false,
            'is_department_chief' => false,
        ]);

        Invoice::create([
            'agency_id' => $otherAgency->id,
            'number' => 'FAC-ETRANGER-001',
            'invoice_date' => now(),
            'total_amount' => 25000,
            'validation_status' => Invoice::VALIDATION_VALIDATED,
        ]);

        // La facture existe bien en base, mais reste hors de la réponse du caissier.
        $this->getJson('/api/invoices?per_page=100')
            ->assertOk()
            ->assertJsonPath('invoices.meta.total', 0)
            ->assertJsonMissing(['number' => 'FAC-ETRANGER-001']);
    }

    /**
     * Un règlement mobile money sans numéro payeur est inexploitable : le numéro
     * utilisé pour la transaction est demandé et conservé sur la facture.
     */
    public function test_mobile_money_invoice_requires_and_keeps_the_payer_phone(): void
    {
        $commercial = $this->createCommercialUser();
        Sanctum::actingAs($commercial);

        $this->post('/api/invoices', [
            'payment_type' => 'om',
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertStatus(422)->assertJsonValidationErrors('payer_phone');

        $invoice = $this->post('/api/invoices', [
            'payment_type' => 'momo',
            'payer_phone' => '+237691234567',
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertCreated()->json();

        $this->assertSame('+237691234567', $invoice['payer_phone']);

        // Le même numéro est reporté sur la preuve, que le caissier examine.
        $this->assertSame(
            '+237691234567',
            PaymentProof::where('invoice_id', $invoice['id'])->value('phone_number_used'),
        );
    }

    /** Un règlement en espèces n'a pas de numéro payeur à demander. */
    public function test_cash_invoice_does_not_require_a_payer_phone(): void
    {
        $this->actingAsRole('caissier');

        $invoice = $this->postJson('/api/invoices', [
            'payment_type' => 'cash',
            'items' => [
                ['label' => 'Coaching', 'unit_price' => 5000, 'quantity' => 1],
            ],
        ])->assertCreated()->json();

        $this->assertNull($invoice['payer_phone']);
    }
}
