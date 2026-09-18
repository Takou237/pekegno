<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Promotion;
use App\Models\Service;
use App\Models\SessionParticipant;
use App\Models\Trainer;
use App\Models\TrainingSession;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Complements CommercialTestDataSeeder / PublicCatalogSeeder / TrainingSessionSeeder :
 * - Formateur relie a un compte Trainer
 * - Un commercial ET un employe SANS compte utilisateur lie (kind=employe, user_id=null)
 * - Promotions sur une partie du catalogue (pas tout, pour avoir du "avec/sans promo")
 * - Inscriptions aux formations (formation_enrollments) + participants de session
 * - Factures supplementaires pour varier les creances (partiel, en attente, autre agence)
 */
class DemoExtrasSeeder extends Seeder
{
    public function run(): void
    {
        $douala = Agency::where('name', 'Agence Principale Douala')->first();
        $yaounde = Agency::where('name', 'Agence Yaoundé Centre')->first();
        $abidjan = Agency::where('name', 'Agence Plateau Abidjan')->first();

        $this->seedTrainer($douala);
        $this->seedCommercialsWithoutAccount($douala, $yaounde);
        $this->seedPromotions();
        $this->seedEnrollments();
        $this->seedExtraInvoices($yaounde, $abidjan);

        $this->command?->info('Données de démo complémentaires créées.');
    }

    private function seedTrainer(?Agency $douala): void
    {
        $formateur = User::where('email', 'emmanuel.ngue@pekegno.com')->first();

        if (! $formateur) {
            return;
        }

        Trainer::firstOrCreate(
            ['user_id' => $formateur->id],
            [
                'agency_id' => $douala?->id,
                'first_name' => $formateur->first_name,
                'last_name' => $formateur->last_name,
                'email' => $formateur->email,
                'phone' => $formateur->phone,
                'bio' => 'Formateur senior spécialisé en formations professionnelles certifiantes.',
                'is_active' => true,
                'points_balance' => 30,
            ]
        );
    }

    private function seedCommercialsWithoutAccount(?Agency $douala, ?Agency $yaounde): void
    {
        if (! $douala || ! $yaounde) {
            return;
        }

        // Commercial terrain, pas encore de compte de connexion cree.
        Commercial::firstOrCreate(
            ['email' => 'boris.simo@pekegno.com'],
            [
                'user_id' => null,
                'agency_id' => $yaounde->id,
                'kind' => 'commercial',
                'first_name' => 'Boris',
                'last_name' => 'Simo',
                'phone' => '+237 690 000 013',
                'commission_type' => 'percent',
                'commission_value' => 4.5,
                'points_balance' => 15,
                'is_active' => true,
            ]
        );

        // Employe (accueil/caisse) sans compte utilisateur non plus.
        Commercial::firstOrCreate(
            ['email' => 'huguette.mvondo@pekegno.com'],
            [
                'user_id' => null,
                'agency_id' => $douala->id,
                'kind' => 'employe',
                'first_name' => 'Huguette',
                'last_name' => 'Mvondo',
                'phone' => '+237 690 000 014',
                'commission_type' => 'none',
                'commission_value' => null,
                'points_balance' => 0,
                'is_active' => true,
            ]
        );
    }

    private function seedPromotions(): void
    {
        $promoted = [
            'Formation Excel Avancé' => ['type' => 'percent', 'discount_percent' => 15],
            'Formation Marketing Digital' => ['type' => 'amount', 'promo_price' => 60000],
            'Audit comptable' => ['type' => 'percent', 'discount_percent' => 10],
        ];

        foreach ($promoted as $serviceName => $promo) {
            $service = Service::where('name', $serviceName)->first();

            if (! $service) {
                continue;
            }

            Promotion::firstOrCreate(
                ['service_id' => $service->id, 'start_date' => now()->startOfMonth()],
                [
                    'type' => $promo['type'],
                    'promo_price' => $promo['type'] === 'amount' ? $promo['promo_price'] : null,
                    'discount_percent' => $promo['type'] === 'percent' ? $promo['discount_percent'] : null,
                    'end_date' => now()->addMonth(),
                ]
            );
        }

        // Les autres services du catalogue restent volontairement sans promotion.
    }

    private function seedEnrollments(): void
    {
        $learners = User::whereIn('email', [
            'alice.client@test.com',
            'brice.client@test.com',
            'claire.client@test.com',
        ])->get()->keyBy('email');

        $seller = User::where('email', 'carlos.fotso@pekegno.com')->first();
        $trainer = Trainer::query()->first();

        $courseExcel = Course::where('code', 'CRS-FRM-001')->first();
        $courseCompta = Course::where('code', 'CRS-FRM-002')->first();

        $plan = [
            ['alice.client@test.com', $courseExcel, 'enrolled'],
            ['brice.client@test.com', $courseExcel, 'enrolled'],
            ['claire.client@test.com', $courseCompta, 'completed'],
        ];

        foreach ($plan as [$email, $course, $status]) {
            if (! $course || ! $learners->has($email)) {
                continue;
            }

            $learner = $learners->get($email);

            $enrollment = FormationEnrollment::firstOrCreate(
                ['course_id' => $course->id, 'learner_user_id' => $learner->id],
                [
                    'seller_user_id' => $seller?->id,
                    'seller_trainer_id' => $trainer?->id,
                    'enrolled_at' => now()->subDays(5),
                    'status' => $status,
                    'notes' => 'Inscription de démonstration',
                ]
            );

            $session = TrainingSession::where('course_id', $course->id)
                ->orderBy('start_at')
                ->first();

            if ($session) {
                SessionParticipant::firstOrCreate(
                    [
                        'training_session_id' => $session->id,
                        'formation_enrollment_id' => $enrollment->id,
                    ],
                    ['status' => $status === 'completed' ? 'completed' : 'enrolled']
                );
            }
        }
    }

    private function seedExtraInvoices(?Agency $yaounde, ?Agency $abidjan): void
    {
        if (! $yaounde || ! $abidjan) {
            return;
        }

        $client = User::where('email', 'brice.client@test.com')->first();
        $commercial = Commercial::where('email', 'boris.simo@pekegno.com')->first();
        $service = Service::where('name', 'Conseil en organisation')->first();
        $caissier = User::where('email', 'youssef.hamid@pekegno.com')->first();

        if (! $client || ! $commercial || ! $service || ! $caissier) {
            return;
        }

        // Facture partiellement payee (creance active).
        $partial = Invoice::firstOrCreate(
            ['number' => 'FAC-TEST-0007'],
            [
                'agency_id' => $yaounde->id,
                'client_id' => $client->id,
                'client_name' => trim("{$client->first_name} {$client->last_name}"),
                'commercial_id' => $commercial->id,
                'seller_user_id' => null,
                'invoice_date' => now()->subDays(10),
                'payment_type' => 'cash',
                'total_amount' => $service->price,
                'amount_paid' => round($service->price * 0.4, 2),
                'discount' => 0,
                'vat_rate' => 0,
                'status' => 'partial',
                'validation_status' => Invoice::VALIDATION_VALIDATED,
                'validated_by' => $caissier->id,
                'validated_at' => now()->subDays(10),
                'source' => 'in_person',
                'commission_amount' => round($commercial->commissionFor($service->price), 2),
                'points_awarded' => 20,
                'comment' => 'Créance partielle - solde restant dû',
            ]
        );

        if ($partial->wasRecentlyCreated) {
            InvoiceItem::create([
                'invoice_id' => $partial->id,
                'service_id' => $service->id,
                'label' => $service->name,
                'unit_price' => $service->price,
                'quantity' => 1,
                'line_total' => $service->price,
            ]);

            InvoicePayment::create([
                'invoice_id' => $partial->id,
                'amount' => $partial->amount_paid,
                'payment_method' => 'cash',
                'is_advance' => true,
                'paid_at' => now()->subDays(10),
                'received_by' => $caissier->id,
                'comment' => 'Acompte',
            ]);
        }

        // Facture en attente de validation, agence Abidjan.
        Invoice::firstOrCreate(
            ['number' => 'FAC-TEST-0008'],
            [
                'agency_id' => $abidjan->id,
                'client_id' => $client->id,
                'client_name' => trim("{$client->first_name} {$client->last_name}"),
                'commercial_id' => $commercial->id,
                'seller_user_id' => null,
                'invoice_date' => now()->subDays(2),
                'payment_type' => null,
                'total_amount' => 220000,
                'amount_paid' => 0,
                'discount' => 0,
                'vat_rate' => 0,
                'status' => 'unpaid',
                'validation_status' => Invoice::VALIDATION_PENDING,
                'validated_by' => null,
                'validated_at' => null,
                'source' => 'in_person',
                'commission_amount' => null,
                'points_awarded' => 0,
                'comment' => 'En attente de validation',
            ]
        );
    }
}
