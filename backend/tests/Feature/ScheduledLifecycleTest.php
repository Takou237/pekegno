<?php

namespace Tests\Feature;

use App\Mail\ContractRenewalReminderMail;
use App\Models\Activity;
use App\Models\Agency;
use App\Models\AgencyNotification;
use App\Models\Contract;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\Prestation;
use App\Models\Role;
use App\Models\SessionParticipant;
use App\Models\SubscriptionPack;
use App\Models\TrainingSession;
use App\Models\User;
use App\Services\PackageService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Tâches planifiées de bout en bout, en avançant l'horloge comme le ferait le
 * cron quotidien : abonnement package (activation, rappels J-30/J-15/J-7/J-1,
 * « à renouveler », expiration, fin de prestation) et académie (statut des
 * sessions selon leurs dates, inscriptions terminées en fin de formation).
 */
class ScheduledLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role, array $extra = []): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')] + $extra);
    }

    private function cronDay(string $date): void
    {
        Carbon::setTestNow($date.' 06:00:00');
        foreach (['academy:refresh-statuses', 'subscriptions:check-expiry', 'agency:check-renewals', 'contracts:refresh-status', 'invoices:check-overdue'] as $command) {
            $this->assertSame(0, Artisan::call($command), "{$command} doit réussir");
        }
    }

    public function test_package_subscription_reminders_and_status_changes(): void
    {
        Mail::fake();
        Carbon::setTestNow('2026-11-01 10:00:00');

        $agency = Agency::factory()->create();
        $chief = $this->user('responsable-agence');
        DB::table('user_assignments')->insert(['user_id' => $chief->id, 'agency_id' => $agency->id, 'is_primary' => true]);
        $client = $this->user('client', ['email' => 'client@example.com']);
        $admin = $this->user('super-admin');
        $director = $this->user('direction-generale');
        $pack = SubscriptionPack::create([
            'agency_id' => $agency->id, 'name' => 'Pack Essentiel', 'price_per_month' => 100000,
            'billing_period' => 'monthly', 'is_public' => true, 'is_active' => true,
        ]);

        $service = app(PackageService::class);

        // Avance supérieure au total : refusée.
        try {
            $service->subscribe($pack, $client, Carbon::parse('2026-11-01'), 3, null, $admin->id, advance: 999999, paymentType: 'cash');
            $this->fail('Une avance supérieure au total doit être refusée.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('advance', $e->errors());
        }

        // 3 mois (01/11 → 31/01), payé au guichet : contrat actif, prestation en cours.
        $result = $service->subscribe($pack, $client, Carbon::parse('2026-11-01'), 3, null, $admin->id, advance: 300000, paymentType: 'cash');
        $contract = $result['contract']->fresh();
        $this->assertSame('2027-01-31', $contract->end_date->toDateString());
        $this->assertSame(Contract::STATUS_ACTIVE, $contract->status);
        $this->assertSame(Prestation::STATUS_IN_PROGRESS, Prestation::find($contract->prestation_id)->status);

        // J-61 : rien.
        $this->cronDay('2026-12-01');
        $this->assertSame(Contract::STATUS_ACTIVE, $contract->fresh()->status);
        $this->assertSame(0, AgencyNotification::where('type', 'contract_renewal')->count());

        // J-30 : « à renouveler », alerte au chef (+ tâche de relance) et au client (+ e-mail).
        $this->cronDay('2027-01-01');
        $this->assertSame(Contract::STATUS_DUE_SOON, $contract->fresh()->status);
        $this->assertSame(1, AgencyNotification::where('user_id', $chief->id)->where('type', 'contract_renewal')->count());
        $this->assertSame(1, AgencyNotification::where('user_id', $client->id)->where('type', 'contract_renewal')->count());
        $this->assertSame(1, Activity::where('subject_id', $contract->id)->where('assigned_to', $chief->id)->count());
        Mail::assertSent(ContractRenewalReminderMail::class, 1);

        // Cron rejoué le même jour : aucun doublon.
        $this->cronDay('2027-01-01');
        $this->assertSame(2, AgencyNotification::where('type', 'contract_renewal')->count());
        Mail::assertSent(ContractRenewalReminderMail::class, 1);

        // J-15, J-7, J-1 : un rappel par seuil.
        $this->cronDay('2027-01-16');
        $this->cronDay('2027-01-24');
        $this->cronDay('2027-01-30');
        $this->assertSame(4, AgencyNotification::where('user_id', $chief->id)->where('type', 'contract_renewal')->count());
        $this->assertSame(4, AgencyNotification::where('user_id', $client->id)->where('type', 'contract_renewal')->count());
        Mail::assertSent(ContractRenewalReminderMail::class, 4);

        // Dernier jour : toujours à renouveler.
        $this->cronDay('2027-01-31');
        $this->assertSame(Contract::STATUS_DUE_SOON, $contract->fresh()->status);

        // Lendemain de la date de fin : expiré, la prestation du package est terminée.
        $this->cronDay('2027-02-01');
        $this->assertSame(Contract::STATUS_EXPIRED, $contract->fresh()->status);
        $this->assertSame(Prestation::STATUS_COMPLETED, Prestation::find($contract->prestation_id)->status);
        $this->assertSame(4, AgencyNotification::where('user_id', $client->id)->where('type', 'contract_renewal')->count(), 'plus de rappel après expiration');

        // Notification « expiré — à renouveler » : chef d'agence, super-admin, direction générale, client.
        foreach ([$chief, $admin, $director, $client] as $recipient) {
            $this->assertSame(1, AgencyNotification::where('user_id', $recipient->id)->where('type', 'contract_expired')->where('entity_id', $contract->id)->count());
        }
        $this->cronDay('2027-02-01');
        $this->assertSame(4, AgencyNotification::where('type', 'contract_expired')->where('entity_id', $contract->id)->count(), 'pas de doublon');

        // Un contrat jamais payé (en attente) ou suspendu expire aussi après sa date de fin.
        $unpaid = $service->subscribe($pack, $client, Carbon::parse('2027-02-01'), 3, null, $admin->id)['contract']->fresh();
        $this->assertSame(Contract::STATUS_PENDING, $unpaid->status);
        $suspended = $service->subscribe($pack, $client, Carbon::parse('2027-02-01'), 3, null, $admin->id, advance: 300000, paymentType: 'cash')['contract'];
        $suspended->update(['status' => Contract::STATUS_SUSPENDED]);
        $this->cronDay('2027-05-01');
        $this->assertSame(Contract::STATUS_EXPIRED, $unpaid->fresh()->status);
        $this->assertSame(Contract::STATUS_EXPIRED, $suspended->fresh()->status);
    }

    public function test_auto_renewal_creates_next_period_and_notifies(): void
    {
        Carbon::setTestNow('2026-11-01 10:00:00');
        $agency = Agency::factory()->create();
        $chief = $this->user('responsable-agence');
        DB::table('user_assignments')->insert(['user_id' => $chief->id, 'agency_id' => $agency->id, 'is_primary' => true]);
        $client = $this->user('client');
        $admin = $this->user('super-admin');
        $director = $this->user('direction-generale');
        $pack = SubscriptionPack::create([
            'agency_id' => $agency->id, 'name' => 'Pack Pro', 'price_per_month' => 50000,
            'billing_period' => 'monthly', 'is_public' => true, 'is_active' => true,
        ]);

        $contract = app(PackageService::class)->subscribe($pack, $client, Carbon::parse('2026-11-01'), 2, null, $admin->id, autoRenew: true, advance: 100000, paymentType: 'cash')['contract']->fresh();
        $this->assertSame('2026-12-31', $contract->end_date->toDateString());

        // Avant le dernier jour : pas de renouvellement.
        $this->cronDay('2026-12-30');
        $this->assertSame(0, Contract::where('parent_contract_id', $contract->id)->count());

        // Dernier jour : période suivante créée (en attente de paiement, nouvelle facture, nouvelle prestation).
        $this->cronDay('2026-12-31');
        $child = Contract::where('parent_contract_id', $contract->id)->firstOrFail();
        $this->assertSame(Contract::STATUS_RENEWED, $contract->fresh()->status);
        $this->assertSame(Contract::STATUS_PENDING, $child->status);
        $this->assertSame('2027-01-01', $child->start_date->toDateString());
        $this->assertNotNull(\App\Models\Invoice::where('contract_id', $child->id)->first(), 'facture du renouvellement');
        $this->assertNotNull($child->prestation_id);
        $this->assertNotSame($contract->prestation_id, $child->prestation_id);
        foreach ([$chief, $admin, $director, $client] as $recipient) {
            $this->assertSame(1, AgencyNotification::where('user_id', $recipient->id)->where('type', 'contract_renewed')->count());
        }

        // Rejoué : un seul renouvellement.
        $this->cronDay('2026-12-31');
        $this->assertSame(1, Contract::where('parent_contract_id', $contract->id)->count());
        $this->assertSame(4, AgencyNotification::where('type', 'contract_renewed')->count());

        // Lendemain : l'ancienne prestation est clôturée ; pas de notification « expiré ».
        $this->cronDay('2027-01-01');
        $this->assertSame(Prestation::STATUS_COMPLETED, Prestation::find($contract->prestation_id)->status);
        $this->assertSame(0, AgencyNotification::where('type', 'contract_expired')->count());
    }

    public function test_session_and_enrollment_statuses_follow_their_dates(): void
    {
        Carbon::setTestNow('2026-10-25 10:00:00');
        $agency = Agency::factory()->create();
        $course = Course::factory()->create(['agency_id' => $agency->id]);

        $session = TrainingSession::factory()->create([
            'course_id' => $course->id, 'agency_id' => $agency->id,
            'start_at' => '2026-11-01 09:00:00', 'end_at' => '2026-11-10 18:00:00', 'status' => 'planned',
        ]);
        $openEnded = TrainingSession::factory()->create([
            'course_id' => $course->id, 'agency_id' => $agency->id,
            'start_at' => '2026-11-01 09:00:00', 'end_at' => null, 'duration_type' => 'unlimited', 'status' => 'planned',
        ]);
        $cancelled = TrainingSession::factory()->create([
            'course_id' => $course->id, 'agency_id' => $agency->id,
            'start_at' => '2026-11-01 09:00:00', 'end_at' => '2026-11-10 18:00:00', 'status' => 'cancelled',
        ]);

        $enroll = function (TrainingSession $s, string $status = FormationEnrollment::STATUS_ENROLLED) use ($course) {
            $learner = $this->user('client');
            $e = FormationEnrollment::create(['course_id' => $course->id, 'learner_user_id' => $learner->id, 'enrolled_at' => now(), 'status' => $status]);
            SessionParticipant::create(['training_session_id' => $s->id, 'formation_enrollment_id' => $e->id, 'status' => 'enrolled']);

            return $e;
        };
        $finished = $enroll($session);
        $stillRunning = $enroll($openEnded);
        $pending = $enroll($session, FormationEnrollment::STATUS_PENDING);

        // Compte neuf à chaque appel : l'horloge avance de plusieurs jours (B26).
        $ids = fn (string $status) => collect(Sanctum::actingAs($this->user('super-admin')) ? $this->getJson("/api/training-sessions?status={$status}&per_page=100")->assertOk()->json('data') : [])->pluck('id')->sort()->values()->all();

        // Avant le début : planifiée.
        $this->cronDay('2026-10-31');
        $this->assertSame('planned', $session->fresh()->getRawOriginal('status'));

        // Pendant : en cours (base + filtre).
        $this->cronDay('2026-11-05');
        $this->assertSame('ongoing', $session->fresh()->getRawOriginal('status'));
        $this->assertSame('ongoing', $openEnded->fresh()->getRawOriginal('status'));
        $this->assertSame(collect([$session->id, $openEnded->id])->sort()->values()->all(), $ids('ongoing'));
        $this->assertSame(FormationEnrollment::STATUS_ENROLLED, $finished->fresh()->status);

        // Après la date de fin : terminée ; l'inscription passe « terminée ».
        $this->cronDay('2026-11-11');
        $this->assertSame('completed', $session->fresh()->getRawOriginal('status'));
        $this->assertSame([$session->id], $ids('completed'));
        $this->assertSame([$cancelled->id], $ids('cancelled'), 'une session annulée reste annulée');
        $this->assertSame(FormationEnrollment::STATUS_COMPLETED, $finished->fresh()->status);
        $this->assertSame(FormationEnrollment::STATUS_ENROLLED, $stillRunning->fresh()->status, 'session sans date de fin : toujours en cours');
        $this->assertSame(FormationEnrollment::STATUS_PENDING, $pending->fresh()->status, 'en attente de validation : inchangée');

        // Rejoué : rien ne bouge.
        $this->cronDay('2026-11-11');
        $this->assertSame('completed', $session->fresh()->getRawOriginal('status'));

        // Date de fin repoussée : la session redevient en cours.
        $session->fresh()->update(['end_at' => '2026-11-20 18:00:00']);
        $this->assertSame('ongoing', $session->fresh()->status);
    }

    public function test_every_daily_task_is_scheduled(): void
    {
        Artisan::call('schedule:list');
        $output = Artisan::output();

        foreach (['academy:refresh-statuses', 'subscriptions:check-expiry', 'agency:check-renewals', 'contracts:refresh-status', 'invoices:check-overdue', 'commissions:compute-period', 'PenalizeInactiveCommercials'] as $task) {
            $this->assertStringContainsString($task, $output);
        }
    }
}
