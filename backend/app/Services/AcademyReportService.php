<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Service;
use App\Models\TrainingSession;
use App\Models\Trainer;
use Illuminate\Support\Carbon;

class AcademyReportService
{
    /**
     * Statistiques académie agrégées au niveau du groupe (toutes agences autorisées).
     * Miroir serveur des calculs de la page « Rapport académie ».
     */
    public function groupStats(?array $agencyIds): array
    {
        $courses = Course::withCount('sessions')
            ->with(['agency'])
            ->when($agencyIds !== null, fn ($q) => $q->where(fn ($c) => $c->whereNull('agency_id')->orWhereIn('agency_id', $agencyIds)))
            ->orderBy('name')
            ->get();

        $sessions = TrainingSession::query()
            ->with(['course:id,name,mode,price,agency_id', 'trainer:id,first_name,last_name'])
            ->withCount(['participants as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')])
            ->when($agencyIds !== null, function ($q) use ($agencyIds) {
                return $q->where(fn ($qq) => $qq->whereIn('agency_id', $agencyIds)
                    ->orWhereHas('course', fn ($c) => $c->whereIn('agency_id', $agencyIds)->orWhereNull('agency_id')));
            })
            ->get();

        $enrollments = FormationEnrollment::with('course:id,name,price,agency_id,mode')
            ->when($agencyIds !== null, fn ($q) => $q->whereHas('course', fn ($c) => $c->whereIn('agency_id', $agencyIds)->orWhereNull('agency_id')))
            ->get();

        $reportRows = [];
        $summary = ['courses' => 0, 'sessions' => 0, 'enrollments' => 0, 'potential_revenue' => 0.0];
        $attendanceTotal = 0;
        $attendancePresent = 0;

        foreach ($courses as $course) {
            $courseSessions = $course->sessions()->withTrashed()->get();
            $sessionIds = $courseSessions->pluck('id');

            $activeEnrollments = FormationEnrollment::where('course_id', $course->id)
                ->whereNot('status', 'cancelled')
                ->get();

            $enrolled = $activeEnrollments->count();
            $present = $sessionIds->isNotEmpty()
                ? Attendance::whereIn('training_session_id', $sessionIds)
                    ->where('status', Attendance::STATUS_PRESENT)
                    ->count()
                : 0;

            $revenue = $courseSessions->sum(function ($session) use ($enrolled, $course) {
                $price = $session->price !== null ? (float) $session->price : (float) ($course->price ?? 0);

                return $enrolled * $price;
            });

            $expectedPresences = $enrolled * $courseSessions->count();
            $rate = $expectedPresences > 0 ? round($present / $expectedPresences * 100, 1) : 0;

            $attendanceTotal += $enrolled;
            $attendancePresent += $present;

            $reportRows[] = [
                'name' => $course->name,
                'sessions_count' => $courseSessions->count(),
                'enrollments_enrolled' => $enrolled,
                'attendance_count' => $present,
                'attendance_rate' => $rate,
            ];

            $summary['courses']++;
            $summary['sessions'] += $courseSessions->count();
            $summary['enrollments'] += $enrolled;
            $summary['potential_revenue'] += $revenue;
        }

        $attendanceByCourse = collect($reportRows)
            ->filter(fn ($r) => $r['enrollments_enrolled'] > 0)
            ->sortByDesc('attendance_rate')
            ->take(6)
            ->values()
            ->map(fn ($r) => [
                'name' => $r['name'],
                'rate' => $r['attendance_rate'],
                'enrolled' => $r['enrollments_enrolled'],
            ])
            ->all();

        $avgAttendance = $attendanceTotal > 0 ? round($attendancePresent / $attendanceTotal * 100) : 0;

        // Répartition par mode : comptée sur le catalogue de formations actives
        // (pas sur les sessions ni les inscriptions) — c'est le mix de formations
        // proposées qui est attendu.
        $modeCounts = ['in_person' => 0, 'online' => 0, 'mixed' => 0];
        foreach ($courses as $course) {
            $mode = $course->mode;
            if ($mode && isset($modeCounts[$mode])) {
                $modeCounts[$mode]++;
            }
        }
        $modeBreakdown = array_map(fn ($mode, $value) => ['mode' => $mode, 'value' => $value], array_keys($modeCounts), $modeCounts);

        $statusCounts = ['planned' => 0, 'ongoing' => 0, 'completed' => 0, 'cancelled' => 0];
        foreach ($sessions as $s) {
            $status = $s->status;
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
        }
        $sessionsByStatus = array_map(fn ($status, $value) => ['status' => $status, 'value' => $value], array_keys($statusCounts), $statusCounts);

        $capacitySessions = $sessions->filter(fn ($s) => $s->max_capacity && $s->max_capacity > 0);
        $avgFill = $capacitySessions->isNotEmpty()
            ? round($capacitySessions->sum(fn ($s) => ($s->enrollments_count ?? 0) / $s->max_capacity) / $capacitySessions->count() * 100)
            : 0;

        $byMonth = [];
        $courseCounts = [];
        $courseRevenue = [];
        foreach ($enrollments as $e) {
            if ($e->enrolled_at !== null) {
                $key = $e->enrolled_at->format('Y-m');
                $byMonth[$key] = ($byMonth[$key] ?? 0) + 1;
            }

            $name = $e->course?->name ?? '—';
            $courseCounts[$name] = ($courseCounts[$name] ?? 0) + 1;
            $courseRevenue[$name] = ($courseRevenue[$name] ?? 0) + (float) ($e->course?->price ?? 0);
        }

        ksort($byMonth);
        $monthlyTrend = array_map(
            fn ($key, $value) => ['month' => $key, 'inscriptions' => $value],
            array_keys(array_slice($byMonth, -12, 12, true)),
            array_values(array_slice($byMonth, -12, 12, true)),
        );

        arsort($courseCounts);
        $topCourses = array_map(
            fn ($name, $count) => ['name' => $name, 'inscriptions' => $count],
            array_keys(array_slice($courseCounts, 0, 5, true)),
            array_values(array_slice($courseCounts, 0, 5, true)),
        );

        arsort($courseRevenue);
        $revenueByCourse = array_map(
            fn ($name, $total) => ['name' => $name, 'revenu' => round((float) $total)],
            array_keys(array_slice($courseRevenue, 0, 5, true)),
            array_values(array_slice($courseRevenue, 0, 5, true)),
        );

        $now = now();
        $upcoming = $sessions
            ->filter(fn ($s) => $s->status === 'planned' && $s->start_at !== null && $s->start_at->gte($now))
            ->sortBy('start_at')
            ->take(6)
            ->values()
            ->map(fn ($s) => [
                'id' => $s->id,
                'course' => $s->course?->name ?? null,
                'trainer' => $s->trainer ? trim(($s->trainer->first_name ?? '').' '.($s->trainer->last_name ?? '')) : null,
                'start_at' => $s->start_at->toISOString(),
                'enrollments_count' => (int) $s->enrollments_count,
                'max_capacity' => $s->max_capacity,
            ])
            ->all();

        $enrollmentInvoiceIds = FormationEnrollment::whereNotNull('invoice_id')->pluck('invoice_id');
        $enrollmentInvoices = Invoice::whereIn('id', $enrollmentInvoiceIds)
            ->whereNull('cancelled_at')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds));
        $received = (float) (clone $enrollmentInvoices)->sum('amount_paid');
        $outstanding = (float) (clone $enrollmentInvoices)
            ->whereIn('status', ['unpaid', 'partial'])
            ->get(['total_amount', 'amount_paid'])
            ->sum(fn ($invoice) => $invoice->balance_due);

        $trainersTotal = Trainer::query()
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->count();

        return [
            'summary' => [
                'courses' => $summary['courses'],
                'sessions' => $summary['sessions'],
                'enrollments' => $summary['enrollments'],
                'potential_revenue' => round($summary['potential_revenue'], 2),
            ],
            'received' => $received,
            'outstanding' => $outstanding,
            'trainers' => $trainersTotal,
            'avg_attendance' => $avgAttendance,
            'avg_fill_rate' => $avgFill,
            'monthly_trend' => $monthlyTrend,
            'mode_breakdown' => $modeBreakdown,
            'top_courses' => $topCourses,
            'sessions_by_status' => $sessionsByStatus,
            'revenue_by_course' => $revenueByCourse,
            'attendance_by_course' => $attendanceByCourse,
            'upcoming' => $upcoming,
        ];
    }

    /**
     * Statistiques académie par agence (cours, sessions, apprenants, taux de
     * présence, encaissé, créances) pour la page « Académies Group ».
     * Optionnellement filtrées par pays et par agence.
     */
    public function academyStatsByAgency(?array $agencyIds, ?array $countryIds = null, ?string $agencyId = null): array
    {
        $agencies = \App\Models\Agency::query()
            ->whereNull('deleted_at')
            ->when($agencyId, fn ($q, $id) => $q->where('id', $id))
            ->when($countryIds !== null, fn ($q) => $q->whereIn('country_id', $countryIds))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'country', 'country_id', 'city']);

        $rows = [];

        foreach ($agencies as $agency) {
            $courseIds = Course::where('agency_id', $agency->id)->pluck('id');
            $globalCourseIds = Course::whereNull('agency_id')->pluck('id');

            $coursesCount = Course::where(fn ($q) => $q->where('agency_id', $agency->id)->orWhereNull('agency_id'))->count();

            $sessionIds = TrainingSession::where('agency_id', $agency->id)->pluck('id');
            $courseSessionIds = TrainingSession::whereIn('course_id', $courseIds)->pluck('id');
            $globalCourseSessionIds = TrainingSession::whereIn('course_id', $globalCourseIds)->whereNull('agency_id')->pluck('id');
            $allSessionIds = $sessionIds->merge($courseSessionIds)->merge($globalCourseSessionIds)->unique()->values();

            $sessionsCount = (clone $allSessionIds)->filter(fn ($id) => $id !== null)->count();

            // Inscriptions liées aux cours de l'agence (+ cours globaux disponibles).
            $enrollments = FormationEnrollment::with('course:id,agency_id')
                ->whereNot('status', 'cancelled')
                ->where(function ($q) use ($agency) {
                    $q->whereHas('course', fn ($c) => $c->where('agency_id', $agency->id)->orWhereNull('agency_id'));
                })
                ->get();

            $learnersCount = $enrollments->pluck('learner_user_id')->unique()->count();

            $present = 0;
            $expected = 0;
            foreach ($enrollments as $e) {
                $eSessionIds = TrainingSession::where('course_id', $e->course_id)->pluck('id');
                $present += Attendance::whereIn('training_session_id', $eSessionIds)
                    ->where('status', Attendance::STATUS_PRESENT)
                    ->where('learner_user_id', $e->learner_user_id)
                    ->count();
                $expected += $eSessionIds->count();
            }
            $attendanceRate = $expected > 0 ? round($present / $expected * 100, 1) : 0;

            // Factures d'inscriptions liées aux cours de l'agence (y compris cours globaux).
            $invoiceIds = FormationEnrollment::with('course:id,agency_id')
                ->whereNotNull('invoice_id')
                ->where(fn ($q) => $q->whereHas('course', fn ($c) => $c->where('agency_id', $agency->id)->orWhereNull('agency_id')))
                ->pluck('invoice_id');

            $received = (float) Invoice::whereIn('id', $invoiceIds)
                ->whereNull('cancelled_at')
                ->sum('amount_paid');
            $outstanding = (float) Invoice::whereIn('id', $invoiceIds)
                ->whereNull('cancelled_at')
                ->whereIn('status', ['unpaid', 'partial'])
                ->get(['total_amount', 'amount_paid'])
                ->sum(fn ($invoice) => $invoice->balance_due);

            $rows[] = [
                'id' => $agency->id,
                'name' => $agency->name,
                'code' => $agency->code,
                'country' => $agency->country,
                'country_id' => $agency->country_id,
                'city' => $agency->city,
                'courses' => (int) $coursesCount,
                'sessions' => (int) $sessionsCount,
                'learners' => (int) $learnersCount,
                'attendance_rate' => $attendanceRate,
                'received' => $received,
                'outstanding' => $outstanding,
            ];
        }

        // Classement composite : encaissé, puis créances, puis apprenants.
        $ranking = collect($rows)->sort(function ($a, $b) {
            return [$b['received'], $b['outstanding'], $b['learners']] <=> [$a['received'], $a['outstanding'], $a['learners']];
        })->values()->all();

        return [
            'agencies' => $rows,
            'ranking' => $ranking,
        ];
    }

    /**
     * Statistiques services agrégées au niveau du groupe (toutes agences autorisées).
     */
    public function groupServices(?array $agencyIds): array
    {
        $servicesQuery = Service::query()
            ->whereNull('deleted_at')
            ->when($agencyIds !== null, fn ($q) => $q->where(fn ($qq) => $qq->whereIn('agency_id', $agencyIds)->orWhereNull('agency_id')));

        $total = (clone $servicesQuery)->count();
        $seminars = (clone $servicesQuery)->where('is_seminar', true)->count();

        $linesQuery = InvoiceItem::query()
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->whereNotNull('invoice_items.service_id')
            ->whereNull('invoices.cancelled_at')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds));

        $aggregate = (clone $linesQuery)
            ->selectRaw('count(distinct invoice_items.service_id) as sold, count(distinct invoices.id) as invoice_count, sum(invoice_items.line_total) as revenue')
            ->first();

        $monthlyRaw = (clone $linesQuery)
            ->whereBetween('invoices.invoice_date', [now()->subMonths(11)->startOfMonth(), now()->endOfDay()])
            ->selectRaw('invoices.invoice_date as d, invoice_items.line_total as t')
            ->get();

        $monthTotals = [];
        foreach ($monthlyRaw as $row) {
            $key = Carbon::parse($row->d)->format('Y-m');
            $monthTotals[$key] = ($monthTotals[$key] ?? 0) + (float) $row->t;
        }

        $monthlyRevenue = [];
        $monthStart = now()->startOfMonth()->subMonths(11);
        for ($i = 0; $i < 12; $i++) {
            $key = $monthStart->copy()->addMonths($i)->format('Y-m');
            $monthlyRevenue[] = ['month' => $key, 'revenue' => round($monthTotals[$key] ?? 0, 2)];
        }

        $topServices = (clone $linesQuery)
            ->leftJoin('services as sv', 'sv.id', '=', 'invoice_items.service_id')
            ->selectRaw('coalesce(invoice_items.label, sv.name) as name, sum(invoice_items.quantity) as quantity, sum(invoice_items.line_total) as revenue, count(distinct invoices.id) as invoice_count')
            ->groupByRaw('coalesce(invoice_items.label, sv.name)')
            ->orderByRaw('sum(invoice_items.line_total) desc')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name ?: '—',
                'quantity' => (int) $row->quantity,
                'revenue' => (float) $row->revenue,
                'invoices' => (int) $row->invoice_count,
            ])
            ->all();

        $byCategory = (clone $linesQuery)
            ->leftJoin('services as sv2', 'sv2.id', '=', 'invoice_items.service_id')
            ->leftJoin('categories as cat', 'cat.id', '=', 'sv2.category_id')
            ->selectRaw('coalesce(cat.name, \'—\') as category, sum(invoice_items.line_total) as revenue, count(*) as count')
            ->groupByRaw('coalesce(cat.name, \'—\')')
            ->orderByRaw('sum(invoice_items.line_total) desc')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category,
                'revenue' => (float) $row->revenue,
                'count' => (int) $row->count,
            ])
            ->all();

        return [
            'summary' => [
                'total' => $total,
                'sold' => (int) ($aggregate->sold ?? 0),
                'seminars' => $seminars,
                'invoices' => (int) ($aggregate->invoice_count ?? 0),
                'revenue' => round((float) ($aggregate->revenue ?? 0), 2),
            ],
            'monthly_revenue' => $monthlyRevenue,
            'top_services' => $topServices,
            'by_category' => $byCategory,
        ];
    }
}