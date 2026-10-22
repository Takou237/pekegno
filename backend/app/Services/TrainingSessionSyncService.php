<?php

namespace App\Services;

use App\Models\Course;
use App\Models\TrainingSession;
use App\Models\TrainingSessionSynced;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TrainingSessionSyncService
{
    public function __construct(
        private readonly ScopeService $scopeService,
    ) {
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  TrainingSession|null  $editedSession  Session en cours de modification
     *                                        (mode mise à jour) ; null = mode création.
     */
    public function syncForCourse(
        Course $course,
        array $data,
        ?string $sourceUserId = null,
        ?bool $isAdminSync = false,
        ?TrainingSession $editedSession = null,
    ): array {
        $agencyIds = $this->targetAgencyIds($course, $data);

        if ($editedSession) {
            return $this->runUpdate($course, $agencyIds, $data, $editedSession);
        }

        return $this->run($course, $agencyIds, $data, $sourceUserId, $isAdminSync);
    }

    private function targetAgencyIds(Course $course, array $data): array
    {
        if (isset($data['sync_across_agencies']) && (bool) $data['sync_across_agencies'] === true) {
            return $this->findSiblingAgencies($course);
        }

        $agencyId = $data['agency_id'] ?? null;

        if (! $agencyId) {
            $agencyId = $course->agency_id ?? $data['agency_id'] ?? null;
        }

        return [$agencyId];
    }

    /** Pour une formation, les agences des autres cours portant le même nom (+ l'agence de la source). */
    private function findSiblingAgencies(Course $source): array
    {
        if (! $source->name) {
            return [];
        }

        $agencyIds = $this->agencyIdsForCourseName($source)
            ->values()
            ->unique();

        return $agencyIds
            ->concat([$source->agency_id])
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Agences (hors agence de la source) ayant un cours portant le même nom.
     * La case « synchroniser » est cochée explicitement par l'utilisateur : on
     * ne restreint donc pas au périmètre d'agences ici, sinon la répercussion
     * serait silencieusement limitée à la seule agence courante.
     */
    private function agencyIdsForCourseName(Course $source): Collection
    {
        $nameLower = mb_strtolower((string) $source->name);

        return DB::table('courses')
            ->select('agency_id')
            ->distinct()
            ->whereRaw('LOWER(name) = ?', [$nameLower])
            ->whereNull('deleted_at')
            ->whereNotNull('agency_id')
            ->when(
                $source->agency_id,
                fn ($query) => $query->where('agency_id', '<>', $source->agency_id)
            )
            ->pluck('agency_id');
    }

    /** @param  array<string, mixed>  $data */
    private function run(
        Course $course,
        array $agencyIds,
        array $data,
        ?string $sourceUserId,
        ?bool $isAdminSync,
    ): array {
        $targetAgencyId = $data['agency_id'] ?? null;

        if (! $targetAgencyId) {
            $targetAgencyId = $course->agency_id ?? null;
        }

        if (! $targetAgencyId) {
            return $this->syncAll($course, $agencyIds, $data, $sourceUserId, $isAdminSync);
        }

        $rows = $this->syncToOne($course, $data, $targetAgencyId, $sourceUserId, $isAdminSync);
        if ($rows) {
            return $rows;
        }

        return $this->syncAll($course, $agencyIds, $data, $sourceUserId, $isAdminSync);
    }

    private function syncAll(
        Course $course,
        array $agencyIds,
        array $data,
        ?string $sourceUserId,
        ?bool $isAdminSync,
    ): array {
        DB::transaction(function () use ($course, $agencyIds, $data, $sourceUserId, $isAdminSync) {
            foreach ($agencyIds as $agencyId) {
                $this->syncToOne($course, $data, $agencyId, $sourceUserId, $isAdminSync, true);
            }
        });

        return $this->readSession($course, ['agency_id' => $data['agency_id'] ?? null]);
    }

    /**
     * Mode modification : répercute les nouvelles valeurs de la session en cours
     * d'édition dans chaque agence cible (mise à jour des sessions existantes,
     * création là où la formation existe mais sans session encore).
     *
     * @param  array<string, mixed>  $data
     */
    private function runUpdate(
        Course $course,
        array $agencyIds,
        array $data,
        TrainingSession $editedSession,
    ): array {
        DB::transaction(function () use ($course, $agencyIds, $data, $editedSession) {
            foreach ($agencyIds as $agencyId) {
                // L'agence de la session éditée est déjà mise à jour par le contrôleur.
                if ($agencyId === $editedSession->agency_id) {
                    continue;
                }

                $this->syncUpdateToOne($course, $data, $agencyId, $editedSession);
            }
        });

        // La table miroir reflète ensuite l'état réel des sessions.
        $this->refreshSyncedSessions($course);

        return $this->readSession($course, ['agency_id' => $data['agency_id'] ?? null]);
    }

    /**
     * Répercute sur l'agence donnée les valeurs de la session en cours de modification.
     */
    private function syncUpdateToOne(
        Course $course,
        array $data,
        string $agencyId,
        TrainingSession $editedSession,
    ): bool {
        if (! $agencyId) {
            return false;
        }

        // On ne répercute que les champs réellement envoyés par la requête,
        // pour ne pas écraser des valeurs propres à chaque agence.
        $row = array_intersect_key($data, array_flip([
            'trainer_id',
            'start_at',
            'end_at',
            'max_capacity',
            'price',
            'status',
        ]));

        if (array_key_exists('module_id', $data)) {
            $row['module_id'] = null;
        }

        $session = $this->findExistingInAgency($course, $agencyId);

        if ($session) {
            $session->update($row);

            return true;
        }

        // Aucune session pour cette formation dans cette agence : on la crée.
        $row += [
            'course_id' => $course->id,
            'agency_id' => $agencyId,
            'start_at' => $row['start_at'] ?? $editedSession->start_at,
            'end_at' => $row['end_at'] ?? $editedSession->end_at,
            'max_capacity' => $row['max_capacity'] ?? $editedSession->max_capacity,
            'status' => $row['status'] ?? $editedSession->status,
        ];

        $created = TrainingSession::create($row);

        if ($created) {
            $this->markSynced($this->sourceSessionIdForCourse($course), $created);
        }

        return true;
    }

    /**
     * Session existante de cette formation dans une agence donnée.
     * Le matching sur start_at est volontairement omis : les dates ont peut-être
     * été modifiées, et c'est justement ce qu'on veut répercuter.
     */
    private function findExistingInAgency(Course $course, string $agencyId): ?TrainingSession
    {
        return TrainingSession::where('course_id', $course->id)
            ->where('agency_id', $agencyId)
            ->whereNull('deleted_at')
            ->orderByDesc('start_at')
            ->first();
    }

    /** @param  array<string, mixed>  $data */
    private function syncToOne(
        Course $course,
        array $data,
        string $agencyId,
        ?string $sourceUserId,
        ?bool $isAdminSync,
        bool $force = false,
    ): bool {
        if (! $agencyId) {
            return false;
        }

        if (! $force && $agencyId === $course->agency_id) {
            return false;
        }

        $moduleId = $data['module_id'] ?? null;
        if (! $moduleId) {
            $moduleId = $data['module_id'] ?? null;
        }

        $trainerId = $data['trainer_id'] ?? null;

        $sourceSession = $this->sourceSession($course, $agencyId, $data);

        $session = $this->findSession($course, $agencyId, $data);

        if ($session) {
            return true;
        }

        $row = $data;
        $row['code'] = Course::generateCode();
        $row['agency_id'] = $agencyId;
        $row['module_id'] = $moduleId;
        $row['trainer_id'] = $trainerId;

        if (! array_key_exists('course_id', $row)) {
            $row['course_id'] = $course->id;
        }

        if (array_key_exists('source_session_id', $row)) {
            unset($row['source_session_id']);
        }

        if (array_key_exists('source_user_id', $row)) {
            $row['source_user_id'] = $sourceUserId;
        }

        if (array_key_exists('status', $row)) {
            unset($row['status']);
        }

        if (array_key_exists('start_at', $row)) {
            $row['start_at'] = $row['start_at'] ?? now();
        }

        if (array_key_exists('end_at', $row)) {
            $row['end_at'] = $row['end_at'] ?? null;
        }

        if (array_key_exists('max_capacity', $row)) {
            $row['max_capacity'] = $row['max_capacity'] ?? null;
        }

        if (array_key_exists('price', $row)) {
            $row['price'] = $row['price'] ?? $course->price;
        }

        if (array_key_exists('location', $row)) {
            $row['location'] = $row['location'] ?? null;
        }

        $created = TrainingSession::create($row);

        if ($created) {
            $this->markSynced($sourceSession, $created);
        }

        return true;
    }

    /** @param  array<string, mixed>  $data */
    private function findSession(Course $course, string $agencyId, array $data): ?TrainingSession
    {
        if (! $course->id) {
            return null;
        }

        if (isset($data['synced_session_id']) && $data['synced_session_id']) {
            return $this->findSynced($course->id, $agencyId, $data['synced_session_id']);
        }

        return $this->findFromSource($course->id, $agencyId, $data);
    }

    private function findSynced(string $courseId, string $agencyId, string $sessionId): ?TrainingSession
    {
        return TrainingSessionSynced::where('course_id', $courseId)
            ->where('agency_id', $agencyId)
            ->where('id', $sessionId)
            ->first();
    }

    private function findFromSource(string $courseId, string $agencyId, array $data): ?TrainingSession
    {
        $session = TrainingSession::where('course_id', $courseId)
            ->where('agency_id', $agencyId)
            ->where('status', '<>', 'cancelled')
            ->first();

        if (! $session) {
            return null;
        }

        if (isset($data['start_at']) && $data['start_at']) {
            $sessionStart = $session->start_at ? $session->start_at->format('Y-m-d H:i:s') : null;
            $requestStart = (string) $data['start_at'];

            if ($sessionStart !== $requestStart) {
                return null;
            }
        }

        return $session;
    }

    private function sourceSession(Course $course, string $agencyId, array $data): ?string
    {
        $courseId = $course->id;

        if (! $courseId) {
            return null;
        }

        if ($course->agency_id && $course->agency_id !== $agencyId) {
            return null;
        }

        $session = TrainingSession::where('course_id', $courseId)
            ->where('agency_id', $agencyId)
            ->whereNull('deleted_at')
            ->orderByDesc('start_at')
            ->first();

        return $session ? (string) $session->id : null;
    }

    private function markSynced(?string $sourceSessionId, TrainingSession $session): void
    {
        if (! $sourceSessionId) {
            return;
        }

        TrainingSessionSynced::create([
            'id' => (string) $session->id,
            'source_session_id' => $sourceSessionId,
            'training_session_id' => $session->id,
            'agency_id' => $session->agency_id,
            'course_id' => $session->course_id,
            'status' => $session->status,
            'start_at' => $session->start_at,
            'end_at' => $session->end_at,
            'location' => $session->location,
            'max_capacity' => $session->max_capacity,
            'price' => $session->price,
            'trainer_id' => $session->trainer_id,
            'module_id' => $session->module_id,
            'source_user_id' => $session->source_user_id,
        ]);
    }

    public function removeStaleSessions(Course $course, array $agenciesToKeep, ?string $currentAgencyId = null): int
    {
        if ($agenciesToKeep === []) {
            return 0;
        }

        if (isset($agenciesToKeep['sync_across_agencies']) && (bool) $agenciesToKeep['sync_across_agencies'] === true) {
            $agenciesToKeep = $this->findSiblingAgencies($course);
            $agenciesToKeep = array_unique(array_merge($agenciesToKeep, [$currentAgencyId ?? $course->agency_id ?: null]));
            $agenciesToKeep = array_filter($agenciesToKeep);
        }

        $agenciesToKeep = array_values(array_filter($agenciesToKeep));

        if ($agenciesToKeep === []) {
            return 0;
        }

        return TrainingSessionSynced::where('course_id', $course->id)
            ->whereNotIn('agency_id', $agenciesToKeep)
            ->where('source_session_id', $this->sourceSessionIdForCourse($course))
            ->delete();
    }

    private function sourceSessionIdForCourse(Course $course): ?string
    {
        return TrainingSession::where('course_id', $course->id)
            ->where('agency_id', $course->agency_id)
            ->whereNull('deleted_at')
            ->first()?->id;
    }

    /** @param  array<string, mixed>  $data */
    public function sourceSessionForCourse(
        Course $course,
        array $data = [],
        ?string $agencyId = null,
        ?string $sessionId = null,
    ): ?TrainingSession {
        if (! $course->id) {
            return null;
        }

        $targetAgencyId = $agencyId;

        if (! $targetAgencyId && isset($data['agency_id'])) {
            $targetAgencyId = $data['agency_id'];
        }

        if (! $targetAgencyId) {
            $targetAgencyId = $course->agency_id;
        }

        if (! $targetAgencyId) {
            return null;
        }

        $query = TrainingSession::where('course_id', $course->id)
            ->where('agency_id', $targetAgencyId)
            ->whereNull('deleted_at');

        if (isset($data['start_at']) && $data['start_at']) {
            $query->where('start_at', $data['start_at']);
        }

        if (isset($data['status'])) {
            $query->where('status', $data['status']);
        }

        $session = $query->first();

        if ($session) {
            return $session;
        }

        if ($sessionId) {
            return TrainingSession::find($sessionId);
        }

        return null;
    }

    /** @param  array<string, mixed>  $data */
    public function readSession(Course $course, array $data = []): ?array
    {
        $agencyId = $data['agency_id'] ?? $course->agency_id ?? null;

        if (! $agencyId) {
            return null;
        }

        $session = $this->sourceSessionForCourse($course, $data, $agencyId, $data['session_id'] ?? null);

        if (! $session) {
            return null;
        }

        return [
            'id' => $session->id,
            'course_id' => $session->course_id,
            'agency_id' => $session->agency_id,
            'trainer_id' => $session->trainer_id,
            'module_id' => $session->module_id,
            'start_at' => $session->start_at?->format('Y-m-d\TH:i:s.vP'),
            'end_at' => $session->end_at?->format('Y-m-d\TH:i:s.vP'),
            'location' => $session->location,
            'max_capacity' => $session->max_capacity,
            'price' => $session->price,
            'status' => $session->status,
            'enrollments_count' => $session->participants()->whereNot('status', 'cancelled')->count(),
        ];
    }

    public function getAgencyIdsForCourse(Course $course): array
    {
        return collect([$course->agency_id])
            ->merge($this->agencyIdsForCourseName($course)->values())
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function isSynced(Course $course, ?string $agencyId): bool
    {
        if (! $course->id || ! $agencyId) {
            return false;
        }

        $synced = TrainingSessionSynced::where('course_id', $course->id)
            ->where('agency_id', $agencyId)
            ->where('source_session_id', $this->sourceSessionIdForCourse($course))
            ->exists();

        if ($synced) {
            return true;
        }

        $session = TrainingSession::where('course_id', $course->id)
            ->where('agency_id', $agencyId)
            ->whereNull('deleted_at')
            ->first();

        return $session !== null;
    }

    public function getSyncedSessions(Course $course): Collection
    {
        $agencyIds = $this->getAgencyIdsForCourse($course);

        return TrainingSessionSynced::where('course_id', $course->id)
            ->whereIn('agency_id', $agencyIds)
            ->with(['agency', 'trainer.user'])
            ->orderBy('agency_id')
            ->get();
    }

    public function refreshSyncedSessions(Course $course): void
    {
        $agencyIds = $this->getAgencyIdsForCourse($course);

        TrainingSessionSynced::where('course_id', $course->id)
            ->whereIn('agency_id', $agencyIds)
            ->whereNull('deleted_at')
            ->get()
            ->each(function (TrainingSessionSynced $synced) use ($course) {
                $session = TrainingSession::where('id', $synced->id)
                    ->where('course_id', $course->id)
                    ->whereNull('deleted_at')
                    ->first();

                if (! $session) {
                    $synced->delete();

                    return;
                }

                $synced->fill([
                    'agency_id' => $session->agency_id,
                    'status' => $session->status,
                    'start_at' => $session->start_at,
                    'end_at' => $session->end_at,
                    'location' => $session->location,
                    'max_capacity' => $session->max_capacity,
                    'price' => $session->price,
                    'trainer_id' => $session->trainer_id,
                    'module_id' => $session->module_id,
                    'source_user_id' => $session->source_user_id,
                ])->save();
            });
    }
}
