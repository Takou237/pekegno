<?php

namespace App\Services;

use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Service;
use App\Models\Trainer;
use App\Models\TrainingSession;
use App\Support\AttendanceStats;
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
            // B23 : périmètre strict. Les cours globaux (agency_id NULL) ne
            // sont comptés que sans filtre d'agence ; dans un département, seuls
            // les cours déployés dans ses agences comptent.
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->orderBy('name')
            ->get();

        $sessions = TrainingSession::query()
            ->with(['course:id,name,mode,price,agency_id', 'trainer:id,first_name,last_name'])
            ->withCount(['participants as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')])
            ->when($agencyIds !== null, function ($q) use ($agencyIds) {
                return $q->where(fn ($qq) => $qq->whereIn('agency_id', $agencyIds)
                    ->orWhereHas('course', fn ($c) => $c->whereIn('agency_id', $agencyIds)));
            })
            ->get();

        // Les inscriptions en attente de validation de facture ne sont pas encore comptées.
        $enrollments = FormationEnrollment::with(['course:id,name,price,agency_id,mode', 'invoice:id,total_amount'])
            ->where('status', '!=', FormationEnrollment::STATUS_PENDING)
            ->when($agencyIds !== null, fn ($q) => $q->whereHas('course', fn ($c) => $c->whereIn('agency_id', $agencyIds)))
            ->get();

        $reportRows = [];
        $summary = ['courses' => 0, 'sessions' => 0, 'enrollments' => 0, 'potential_revenue' => 0.0];
        $attendanceExpected = 0;
        $attendancePresent = 0;

        foreach ($courses as $course) {
            $courseSessions = $course->sessions()->withTrashed()->get();

            $activeEnrollments = FormationEnrollment::where('course_id', $course->id)
                ->active()
                ->with('invoice:id,total_amount,cancelled_at')
                ->get();

            $enrolled = $activeEnrollments->count();

            // B22 : présents / attendus sur les séances passées, formule et
            // attendus uniques (AttendanceStats), comme les deux autres écrans.
            $attendance = AttendanceStats::compute($courseSessions);

            $revenue = self::enrollmentsRevenue($activeEnrollments, $course);

            $attendanceExpected += $attendance['expected'];
            $attendancePresent += $attendance['present'];

            $reportRows[] = [
                'id' => $course->id,
                'code' => $course->code,
                'name' => $course->name,
                'sessions_count' => $courseSessions->count(),
                'enrollments_enrolled' => $enrolled,
                'attendance_count' => $attendance['present'],
                'attendance_expected' => $attendance['expected'],
                'attendance_marked' => $attendance['marked'],
                'attendance_rate' => $attendance['rate'],
                'potential_revenue' => round($revenue, 2),
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

        // null (pas 0) quand aucune présence n'était attendue : distinct de "tout le
        // monde était absent".
        $avgAttendance = $attendanceExpected > 0
            ? round(min(100, $attendancePresent / $attendanceExpected * 100))
            : null;

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

        // Une session en surbooking (plus d'inscrits que la capacité) a un taux de
        // remplissage individuel borné à 100 % avant moyenne, pour éviter un taux
        // de remplissage moyen aberrant (ex. 125 %).
        $capacitySessions = $sessions->filter(fn ($s) => $s->max_capacity && $s->max_capacity > 0);
        // null (pas 0) quand aucune session n'a de capacité renseignée : "0 %"
        // laisserait croire que le remplissage est nul, alors qu'il n'y a simplement
        // pas de donnée (personne n'a saisi de capacité max sur les sessions).
        $avgFill = $capacitySessions->isNotEmpty()
            ? round($capacitySessions->sum(fn ($s) => min(1, ($s->enrollments_count ?? 0) / $s->max_capacity)) / $capacitySessions->count() * 100)
            : null;

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
            // Montant réellement facturé (promotion et remise comprises), sinon
            // le prix effectif de la formation.
            $courseRevenue[$name] = ($courseRevenue[$name] ?? 0)
                + (float) ($e->invoice?->total_amount ?? $e->course?->effective_price ?? $e->course?->price ?? 0);
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
            ->validated()
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
            'by_formation' => $reportRows,
            'upcoming' => $upcoming,
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
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
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

    /**
     * Revenus d'une formation = somme des montants de ses inscriptions actives
     * (B7) : le montant de la facture de l'inscription (remise comprise), ou le
     * prix de la formation sans facture. Une inscription compte UNE fois, quel que
     * soit le nombre de sessions (l'ancien calcul inscrits × prix × sessions
     * gonflait le chiffre, ex. CRS-00001 : 35 × 189 000 × 4).
     *
     * @param  \Illuminate\Support\Collection<int, FormationEnrollment>  $enrollments  avec la relation invoice chargée
     */
    public static function enrollmentsRevenue(\Illuminate\Support\Collection $enrollments, Course $course): float
    {
        $price = (float) ($course->effective_price ?? $course->price ?? 0);

        // B7 : chaque inscription compte pour SA part de la facture : la part
        // « formation » (lignes libres, hors articles du catalogue, packages,
        // prestations) répartie entre les inscriptions de cette facture. Une
        // facture de plusieurs inscriptions, ou avec un livre en plus, n'est
        // donc jamais comptée en entier pour chaque inscription.
        $invoiceIds = $enrollments->pluck('invoice_id')->filter()->unique()->values();
        $lines = $invoiceIds->isEmpty() ? collect() : \Illuminate\Support\Facades\DB::table('invoice_items')
            ->whereIn('invoice_id', $invoiceIds)
            ->groupBy('invoice_id')
            ->selectRaw('invoice_id, sum(line_total) as all_lines, sum(case when service_id is null and product_id is null and package_id is null and prestation_id is null then line_total else 0 end) as formation_lines')
            ->get()
            ->keyBy('invoice_id');
        $perInvoice = $invoiceIds->isEmpty() ? collect() : FormationEnrollment::query()
            ->whereIn('invoice_id', $invoiceIds)
            ->selectRaw('invoice_id, count(*) as total')
            ->groupBy('invoice_id')
            ->pluck('total', 'invoice_id');

        return round((float) $enrollments->sum(function (FormationEnrollment $e) use ($price, $lines, $perInvoice) {
            if ($e->invoice && $e->invoice->cancelled_at === null) {
                $line = $lines->get($e->invoice_id);
                $share = ($line && (float) $line->all_lines > 0)
                    ? (float) $line->formation_lines / (float) $line->all_lines
                    : 1.0;

                return (float) $e->invoice->total_amount * $share / max(1, (int) ($perInvoice[$e->invoice_id] ?? 1));
            }

            return $e->invoice_id ? 0.0 : $price;
        }));
    }
}
