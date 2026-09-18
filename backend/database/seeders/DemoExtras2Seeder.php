<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\Agency;
use App\Models\Attendance;
use App\Models\Certificate;
use App\Models\Commercial;
use App\Models\Company;
use App\Models\Contract;
use App\Models\FormationEnrollment;
use App\Models\LearnerObservation;
use App\Models\Opportunity;
use App\Models\Prospect;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\SubscriptionPack;
use App\Models\TrainingSession;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Complement final : CRM (entreprises/opportunites/activites), contrats,
 * abonnements, certificats, presences et observations formateur.
 * Idempotent (firstOrCreate sur des cles naturelles).
 */
class DemoExtras2Seeder extends Seeder
{
    public function run(): void
    {
        $company = $this->seedCrm();
        $this->seedContract($company);
        $this->seedSubscription();
        $this->seedCertificate();
        $this->seedAttendances();
        $this->seedLearnerObservations();

        $this->command?->info('Complément CRM / contrats / abonnements / certificats créé.');
    }

    private function seedCrm(): ?Company
    {
        $douala = Agency::where('name', 'Agence Principale Douala')->first();
        $commercial = Commercial::where('email', 'carlos.fotso@pekegno.com')->first();
        $prospect = Prospect::where('email', 'daniel.wamba@test.com')->first();

        if (! $douala || ! $commercial) {
            return null;
        }

        $company = Company::firstOrCreate(
            ['name' => 'SOCAPALM Douala'],
            [
                'industry' => 'Agro-industrie',
                'phone' => '+237 233 40 00 00',
                'email' => 'contact@socapalm-demo.test',
                'address' => 'Zone industrielle, Bassa',
                'city' => 'Douala',
                'country' => 'Cameroun',
                'website' => 'https://socapalm-demo.test',
            ]
        );

        $opportunity = Opportunity::firstOrCreate(
            ['title' => 'Formation continue équipe RH — SOCAPALM'],
            [
                'prospect_id' => $prospect?->id,
                'company_id' => $company->id,
                'agency_id' => $douala->id,
                'commercial_id' => $commercial->id,
                'stage' => 'proposal',
                'expected_amount' => 450000,
                'expected_close_date' => now()->addDays(20)->toDateString(),
            ]
        );

        Activity::firstOrCreate(
            [
                'subject_type' => 'opportunity',
                'subject_id' => $opportunity->id,
                'title' => 'Relance devis formation RH',
            ],
            [
                'assigned_to' => $commercial->user_id,
                'created_by' => $commercial->user_id,
                'type' => 'call',
                'notes' => 'Client demande un délai de réflexion, relancer sous 10 jours.',
                'due_at' => now()->addDays(10),
            ]
        );

        return $company;
    }

    private function seedContract(?Company $company): void
    {
        $douala = Agency::where('name', 'Agence Principale Douala')->first();
        $client = User::where('email', 'brice.client@test.com')->first();

        if (! $douala || ! $client) {
            return;
        }

        Contract::firstOrCreate(
            ['number' => 'CTR-TEST-0001'],
            [
                'client_id' => $client->id,
                'company_id' => $company?->id,
                'agency_id' => $douala->id,
                'start_date' => now()->subMonths(2)->toDateString(),
                'end_date' => now()->addMonths(10)->toDateString(),
                'billing_cycle' => 'monthly',
                'amount' => 75000,
                'status' => 'active',
                'auto_renew' => true,
                'notes' => 'Contrat cadre formation continue.',
            ]
        );
    }

    private function seedSubscription(): void
    {
        $douala = Agency::where('name', 'Agence Principale Douala')->first();
        $client = User::where('email', 'alice.client@test.com')->first();
        $service = Service::where('name', 'Formation Excel Avancé')->first();

        if (! $douala || ! $client || ! $service) {
            return;
        }

        $pack = SubscriptionPack::firstOrCreate(
            ['agency_id' => $douala->id, 'name' => 'Pack Accès Illimité Formations'],
            [
                'description' => 'Accès illimité aux formations du catalogue pendant la durée de l\'abonnement.',
                'is_active' => true,
                'price_per_month' => 25000,
            ]
        );

        \App\Models\SubscriptionPackService::firstOrCreate(
            ['subscription_pack_id' => $pack->id, 'service_id' => $service->id],
            ['price_per_month' => 25000],
        );

        Subscription::firstOrCreate(
            ['subscription_pack_id' => $pack->id, 'client_id' => $client->id],
            [
                'agency_id' => $douala->id,
                'months' => 6,
                'price_per_month' => 25000,
                'total_price' => 150000,
                'start_date' => now()->subMonth()->toDateString(),
                'end_date' => now()->addMonths(5)->toDateString(),
                'status' => 'active',
            ]
        );
    }

    private function seedCertificate(): void
    {
        $enrollment = FormationEnrollment::where('status', 'completed')->first();

        if (! $enrollment) {
            return;
        }

        $admin = User::where('email', 'admin@pekegno.com')->first();

        Certificate::firstOrCreate(
            ['enrollment_id' => $enrollment->id],
            [
                'number' => 'CERT-TEST-0001',
                'issued_on' => now()->toDateString(),
                'mention' => 'Très bien',
                'status' => 'issued',
                'created_by' => $admin?->id,
            ]
        );
    }

    private function seedAttendances(): void
    {
        $session = TrainingSession::query()->orderBy('start_at')->first();
        $formateur = User::where('email', 'emmanuel.ngue@pekegno.com')->first();
        $learners = User::whereIn('email', ['alice.client@test.com', 'brice.client@test.com'])->get();

        if (! $session || $learners->isEmpty()) {
            return;
        }

        foreach ($learners as $i => $learner) {
            Attendance::firstOrCreate(
                ['training_session_id' => $session->id, 'learner_user_id' => $learner->id],
                [
                    'status' => $i === 0 ? 'present' : 'absent',
                    'recorded_by' => $formateur?->id,
                    'recorded_at' => now(),
                ]
            );
        }
    }

    private function seedLearnerObservations(): void
    {
        $formateur = User::where('email', 'emmanuel.ngue@pekegno.com')->first();
        $learner = User::where('email', 'alice.client@test.com')->first();
        $course = \App\Models\Course::where('code', 'CRS-FRM-001')->first();

        if (! $formateur || ! $learner || ! $course) {
            return;
        }

        LearnerObservation::firstOrCreate(
            ['learner_user_id' => $learner->id, 'course_id' => $course->id, 'author_user_id' => $formateur->id],
            [
                'content' => 'Très bonne participation, maîtrise rapide des tableaux croisés dynamiques.',
                'visible_to_client' => true,
            ]
        );
    }
}
