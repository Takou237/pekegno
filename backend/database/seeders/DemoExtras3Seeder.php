<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Service;
use App\Models\SessionParticipant;
use App\Models\TrainingSession;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Complement demo : plus de formations (cours + sessions), plus d'achats
 * (commandes + factures NON payees, prêtes a etre encaissees par le
 * caissier), et plus d'inscriptions aux formations.
 * Idempotent (firstOrCreate / updateOrCreate).
 */
class DemoExtras3Seeder extends Seeder
{
    public function run(): void
    {
        $newClients = $this->seedExtraClients();
        $courses = $this->seedMoreCourses();
        $this->seedMoreSessions($courses);
        $this->seedPendingOrdersAndInvoices($newClients);
        $this->seedMoreEnrollments($courses, $newClients);

        $this->command?->info('Formations, achats en attente et inscriptions supplémentaires créés.');
    }

    /**
     * @return array<string, User>
     */
    private function seedExtraClients(): array
    {
        $clientRole = \App\Models\Role::where('name', 'client')->first();

        $data = [
            'david' => ['email' => 'david.fouda@test.com', 'first_name' => 'David', 'last_name' => 'Fouda'],
            'estelle' => ['email' => 'estelle.nguema@test.com', 'first_name' => 'Estelle', 'last_name' => 'Nguema'],
        ];

        $clients = [];
        foreach ($data as $key => $d) {
            $clients[$key] = User::firstOrCreate(
                ['email' => $d['email']],
                [
                    'username' => strtolower($d['first_name']).'.tclient',
                    'password' => Hash::make('password'),
                    'first_name' => $d['first_name'],
                    'last_name' => $d['last_name'],
                    'role_id' => $clientRole?->id,
                    'is_active' => true,
                    'is_password_change_required' => false,
                ]
            );
        }

        // On garde aussi les 3 clients déjà existants pour varier.
        foreach (['alice.client@test.com', 'brice.client@test.com', 'claire.client@test.com'] as $email) {
            $key = explode('.', $email)[0];
            $clients[$key] = User::where('email', $email)->first();
        }

        return array_filter($clients);
    }

    /**
     * @return array<string, Course>
     */
    private function seedMoreCourses(): array
    {
        $douala = Agency::where('name', 'Agence Principale Douala')->first();
        $yaounde = Agency::where('name', 'Agence Yaoundé Centre')->first();
        $abidjan = Agency::where('name', 'Agence Plateau Abidjan')->first();

        $defs = [
            ['code' => 'CRS-FRM-003', 'name' => 'Formation Marketing Digital', 'price' => 60000, 'agency' => $yaounde, 'modules' => ['Réseaux sociaux', 'SEO & SEA', 'Publicité en ligne']],
            ['code' => 'CRS-FRM-004', 'name' => 'Formation Gestion de Projet', 'price' => 85000, 'agency' => $abidjan, 'modules' => ['Méthodologies agiles', 'Planification', 'Pilotage & reporting']],
            ['code' => 'CRS-FRM-005', 'name' => 'Formation Communication Professionnelle', 'price' => 55000, 'agency' => $douala, 'modules' => ['Prise de parole', 'Rédaction professionnelle']],
            ['code' => 'CRS-FRM-006', 'name' => 'Formation RH & Paie', 'price' => 90000, 'agency' => $yaounde, 'modules' => ['Droit du travail', 'Gestion de la paie', 'Recrutement']],
        ];

        $courses = [];
        foreach ($defs as $def) {
            $course = Course::updateOrCreate(
                ['code' => $def['code']],
                [
                    'name' => $def['name'],
                    'description' => "Formation certifiante : {$def['name']}.",
                    'price' => $def['price'],
                    'mode' => 'presentiel',
                    'duration_hours' => 16,
                    'duration_type' => 'hours',
                    'agency_id' => $def['agency']?->id,
                    'is_active' => true,
                    'is_public' => true,
                ]
            );

            if ($course->modules()->count() === 0) {
                foreach ($def['modules'] as $order => $name) {
                    CourseModule::create([
                        'course_id' => $course->id,
                        'name' => $name,
                        'order_index' => $order + 1,
                    ]);
                }
            }

            $courses[$def['code']] = $course;
        }

        return $courses;
    }

    /**
     * @param  array<string, Course>  $courses
     */
    private function seedMoreSessions(array $courses): void
    {
        $trainer = Trainer::query()->first();

        $plan = [
            ['CRS-FRM-003', 'Session Novembre', 30, 18],
            ['CRS-FRM-004', 'Session Décembre', 60, 15],
            ['CRS-FRM-005', 'Session Octobre', 12, 25],
            ['CRS-FRM-006', 'Session Janvier', 90, 20],
        ];

        foreach ($plan as [$code, $label, $daysFromNow, $capacity]) {
            $course = $courses[$code] ?? null;

            if (! $course) {
                continue;
            }

            TrainingSession::updateOrCreate(
                [
                    'course_id' => $course->id,
                    'start_at' => now()->addDays($daysFromNow)->setTime(9, 0),
                ],
                [
                    'agency_id' => $course->agency_id,
                    'trainer_id' => $trainer?->id,
                    'end_at' => now()->addDays($daysFromNow)->setTime(17, 0),
                    'max_capacity' => $capacity,
                    'price' => $course->price,
                    'status' => 'planned',
                ]
            );
        }
    }

    /**
     * Achats (commandes + factures) NON payés, dans plusieurs agences,
     * prêts à être encaissés par le caissier.
     *
     * @param  array<string, User>  $clients
     */
    private function seedPendingOrdersAndInvoices(array $clients): void
    {
        $douala = Agency::where('name', 'Agence Principale Douala')->first();
        $yaounde = Agency::where('name', 'Agence Yaoundé Centre')->first();
        $abidjan = Agency::where('name', 'Agence Plateau Abidjan')->first();
        $carlos = Commercial::where('email', 'carlos.fotso@pekegno.com')->first();
        $fatima = Commercial::where('email', 'fatima.bello@pekegno.com')->first();
        $boris = Commercial::where('email', 'boris.simo@pekegno.com')->first();

        $admin = User::where('email', 'admin@pekegno.com')->first();

        if (! $douala || ! $yaounde || ! $abidjan) {
            return;
        }

        // [client, agence, commercial, "Service:qty,...", jours dans le passe (invoice_date)]
        $specs = [
            ['david', $douala, $carlos, 'Formation Marketing Digital:1', 1],
            ['estelle', $yaounde, $fatima, 'Formation RH & Paie:1', 2],
            ['alice', $abidjan, $boris, 'Formation Gestion de Projet:1', 0],
            ['david', $yaounde, $fatima, 'Formation Communication Professionnelle:1,Conseil en organisation:1', 3],
            ['brice', $douala, $carlos, 'Audit fiscal:1', 1],
            ['estelle', $abidjan, $boris, 'Conseil juridique:1', 0],
        ];

        foreach ($specs as $i => [$clientKey, $agency, $commercial, $itemsSpec, $daysAgo]) {
            $client = $clients[$clientKey] ?? null;

            if (! $client || ! $commercial) {
                continue;
            }

            $lines = [];
            $subtotal = 0.0;

            foreach (explode(',', $itemsSpec) as $pair) {
                [$serviceName, $qtyStr] = explode(':', $pair);
                $service = Service::where('name', $serviceName)->first();

                if (! $service) {
                    continue;
                }

                $qty = (int) $qtyStr;
                $price = (float) $service->price;
                $subtotal += $price * $qty;
                $lines[] = [
                    'service_id' => $service->id,
                    'label' => $serviceName,
                    'unit_price' => $price,
                    'quantity' => $qty,
                    'line_total' => round($price * $qty, 2),
                ];
            }

            if (empty($lines)) {
                continue;
            }

            $number = 'CMD-TEST-ACH'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT);
            $orderDate = now()->subDays($daysAgo);

            $order = Order::firstOrCreate(
                ['number' => $number],
                [
                    'agency_id' => $agency->id,
                    'client_id' => $client->id,
                    'commercial_id' => $commercial->id,
                    'status' => 'confirmed',
                    'channel' => 'in_person',
                    'order_date' => $orderDate->toDateString(),
                    'subtotal' => $subtotal,
                    'discount' => 0,
                    'vat_rate' => 0,
                    'total_amount' => $subtotal,
                    'notes' => 'Commande en attente d\'encaissement',
                ]
            );

            if (! $order->wasRecentlyCreated) {
                continue;
            }

            foreach ($lines as $line) {
                OrderLine::create(array_merge($line, ['order_id' => $order->id, 'line_type' => 'catalog']));
            }

            $invoiceNumber = 'FAC-TEST-ACH'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT);

            $invoice = Invoice::create([
                'number' => $invoiceNumber,
                'agency_id' => $agency->id,
                'client_id' => $client->id,
                'client_name' => trim("{$client->first_name} {$client->last_name}"),
                'commercial_id' => $commercial->id,
                'seller_user_id' => $commercial->user_id,
                'invoice_date' => $orderDate,
                'payment_type' => null,
                'total_amount' => $subtotal,
                'amount_paid' => 0,
                'discount' => 0,
                'vat_rate' => 0,
                'status' => 'unpaid',
                'validation_status' => Invoice::VALIDATION_VALIDATED,
                'validated_by' => $admin?->id,
                'validated_at' => $orderDate,
                'source' => 'in_person',
                'commission_amount' => round($commercial->commissionFor($subtotal), 2),
                'points_awarded' => 0,
                'comment' => "Commande {$order->number} — à encaisser",
            ]);

            foreach ($lines as $line) {
                InvoiceItem::create(array_merge($line, ['invoice_id' => $invoice->id]));
            }

            $order->update(['invoice_id' => $invoice->id]);
        }
    }

    /**
     * @param  array<string, Course>  $courses
     * @param  array<string, User>  $clients
     */
    private function seedMoreEnrollments(array $courses, array $clients): void
    {
        $seller = User::where('email', 'fatima.bello@pekegno.com')->first();
        $trainer = Trainer::query()->first();

        $plan = [
            ['CRS-FRM-003', 'david'],
            ['CRS-FRM-004', 'estelle'],
            ['CRS-FRM-005', 'brice'],
            ['CRS-FRM-006', 'alice'],
            ['CRS-FRM-003', 'claire'],
        ];

        foreach ($plan as [$code, $clientKey]) {
            $course = $courses[$code] ?? null;
            $learner = $clients[$clientKey] ?? null;

            if (! $course || ! $learner) {
                continue;
            }

            $enrollment = FormationEnrollment::firstOrCreate(
                ['course_id' => $course->id, 'learner_user_id' => $learner->id],
                [
                    'seller_user_id' => $seller?->id,
                    'seller_trainer_id' => $trainer?->id,
                    'enrolled_at' => now()->subDays(2),
                    'status' => 'enrolled',
                    'notes' => 'Inscription de démonstration',
                ]
            );

            $session = TrainingSession::where('course_id', $course->id)->orderBy('start_at')->first();

            if ($session) {
                SessionParticipant::firstOrCreate(
                    ['training_session_id' => $session->id, 'formation_enrollment_id' => $enrollment->id],
                    ['status' => 'enrolled']
                );
            }
        }
    }
}
