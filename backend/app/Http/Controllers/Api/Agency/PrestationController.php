<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\Prestation;
use App\Services\AgencyAccessService;
use App\Services\PrestationReviewService;
use App\Services\PrestationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Prestations Agency : CRUD, workflow (D9), grand tableau de suivi. */
class PrestationController extends Controller
{
    private const LIST_RELATIONS = [
        'category:id,name,color',
        'client:id,first_name,last_name,email',
        'commercial:id,first_name,last_name',
        'package:id,name',
        'contract:id,number,status',
        'actions',
    ];

    public function __construct(
        private readonly PrestationService $prestations,
        private readonly PrestationReviewService $reviews,
        private readonly AgencyAccessService $access,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = $this->filtered($request)->with(self::LIST_RELATIONS);

        $perPage = min((int) $request->input('per_page', 15), 100);

        return response()->json($query->orderByDesc('created_at')->paginate($perPage));
    }

    /**
     * Grand tableau « Suivi des prestations » : Prestations · Notes · Statut · Motif.
     */
    public function tracking(Request $request): JsonResponse
    {
        $query = $this->filtered($request)
            ->with(['client:id,first_name,last_name', 'category:id,name', 'commercial:id,first_name,last_name'])
            ->when($request->filled('min_rating'), fn ($q) => $q->where('rating_avg', '>=', (float) $request->min_rating));

        $sort = in_array($request->sort, ['rating_avg', 'status', 'end_date', 'name'], true) ? $request->sort : 'created_at';
        $direction = $request->direction === 'asc' ? 'asc' : 'desc';

        $perPage = min((int) $request->input('per_page', 25), 100);

        return response()->json($query->orderBy($sort, $direction)->paginate($perPage)->through(fn (Prestation $p) => $this->trackingRow($p)));
    }

    public function exportTracking(Request $request): StreamedResponse
    {
        $rows = $this->filtered($request)
            ->with(['client:id,first_name,last_name', 'category:id,name', 'commercial:id,first_name,last_name'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Prestation $p) => $this->trackingRow($p));

        $line = fn (array $fields) => implode(',', array_map(function ($value) {
            $value = (string) ($value ?? '');

            return Str::contains($value, [',', '"', "\n", "\r"]) ? '"'.str_replace('"', '""', $value).'"' : $value;
        }, $fields))."\n";

        return response()->streamDownload(function () use ($rows, $line) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF".$line(['Référence', 'Prestation', 'Client', 'Catégorie', 'Commercial', 'Début', 'Fin', 'Note', 'Nb avis', 'Statut', 'Motif']));
            foreach ($rows as $r) {
                fwrite($out, $line([
                    $r['reference'], $r['name'], $r['client'], $r['category'], $r['commercial'],
                    $r['start_date'], $r['end_date'], $r['rating_avg'], $r['rating_count'], $r['status'], $r['status_reason'],
                ]));
            }
            fclose($out);
        }, 'suivi-prestations.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function show(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        $prestation->load([
            'category:id,name,color',
            'client:id,first_name,last_name,email,phone',
            'company:id,name',
            'commercial:id,first_name,last_name',
            'package:id,name',
            'contract',
            'contract.invoices.payments',
            'agency:id,name',
            'department:id,name',
            'validator:id,first_name,last_name',
            'actions.assignee:id,first_name,last_name',
            'teamMembers.user:id,first_name,last_name,email',
            'teamMembers.teamRole:id,name,color',
        ]);

        return response()->json($prestation->toArray() + [
            'rating_summary' => $this->reviews->summaryForPrestation($prestation),
            'allowed_transitions' => Prestation::TRANSITIONS[$prestation->status] ?? [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        abort_unless($this->access->canAccessAgency($request->user(), $data['agency_id']), 403, 'Agence hors de votre périmètre.');
        abort_unless(\App\Models\User::find($data['client_id'])?->role?->name === 'client', 422, 'Le client lié doit avoir le rôle client.');

        // Un commercial ne peut créer une prestation qu'à son nom.
        if ($request->user()->role?->name === 'commercial') {
            $own = $this->access->commercialIds($request->user());
            if (empty($data['commercial_id']) || ! in_array($data['commercial_id'], $own, true)) {
                $data['commercial_id'] = $own[0] ?? null;
            }
        }

        $prestation = $this->prestations->create($data, $request->user());

        return response()->json($prestation->load(self::LIST_RELATIONS), 201);
    }

    public function update(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        $data = $this->validated($request, update: true);
        unset($data['agency_id']);

        $start = $data['start_date'] ?? $prestation->start_date->toDateString();
        $end = $data['end_date'] ?? $prestation->end_date->toDateString();
        abort_if($end < $start, 422, 'La date de fin doit être postérieure ou égale à la date de début.');

        return response()->json($this->prestations->update($prestation, $data)->load(self::LIST_RELATIONS));
    }

    public function destroy(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        abort_if($prestation->contract_id !== null, 422, 'Une prestation liée à un contrat ne peut pas être supprimée : annulez-la.');

        $prestation->delete();

        return response()->json(null, 204);
    }

    public function submit(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        return response()->json($this->prestations->submit($prestation));
    }

    /** D9 : chef d'agence (son périmètre) ou direction — permission prestations.valider. */
    public function validatePrestation(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        $prestation = $this->prestations->validate($prestation, $request->user());

        return response()->json($prestation->load('contract.invoices'));
    }

    public function reject(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);

        return response()->json($this->prestations->reject($prestation, $data['reason']));
    }

    public function backToDraft(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        return response()->json($this->prestations->backToDraft($prestation));
    }

    public function start(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        return response()->json($this->prestations->start($prestation));
    }

    public function suspend(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);

        return response()->json($this->prestations->suspend($prestation, $data['reason']));
    }

    public function resume(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        return response()->json($this->prestations->resume($prestation));
    }

    public function cancel(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);

        return response()->json($this->prestations->cancel($prestation, $data['reason']));
    }

    public function complete(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        return response()->json($this->prestations->complete($prestation));
    }

    private function filtered(Request $request): Builder
    {
        $query = $this->access->scopePrestations(Prestation::query(), $request->user());

        return $query
            ->when($request->agency_id, fn ($q, $id) => $q->where('prestations.agency_id', $id))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->status, fn ($q, $s) => $q->whereIn('status', explode(',', $s)))
            ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
            ->when($request->commercial_id, fn ($q, $id) => $q->where('commercial_id', $id))
            ->when($request->category_id, fn ($q, $id) => $q->where('category_id', $id))
            ->when($request->package_id, fn ($q, $id) => $q->where('package_id', $id))
            ->when($request->from, fn ($q, $d) => $q->whereDate('end_date', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->whereDate('start_date', '<=', $d))
            ->when($request->search, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$s}%")
                ->orWhere('reference', 'like', "%{$s}%")
                ->orWhereHas('client', fn ($c) => $c->where('first_name', 'like', "%{$s}%")->orWhere('last_name', 'like', "%{$s}%"))));
    }

    private function trackingRow(Prestation $p): array
    {
        return [
            'id' => $p->id,
            'reference' => $p->reference,
            'name' => $p->name,
            'client' => $p->client ? trim($p->client->first_name.' '.$p->client->last_name) : null,
            'category' => $p->category?->name,
            'commercial' => $p->commercial ? trim($p->commercial->first_name.' '.$p->commercial->last_name) : null,
            'start_date' => $p->start_date?->toDateString(),
            'end_date' => $p->end_date?->toDateString(),
            'rating_avg' => $p->rating_avg !== null ? (float) $p->rating_avg : null,
            'rating_count' => $p->rating_count,
            'status' => $p->status,
            'status_reason' => $p->status_reason,
            'allowed_transitions' => Prestation::TRANSITIONS[$p->status] ?? [],
        ];
    }

    private function validated(Request $request, bool $update = false): array
    {
        $required = $update ? 'sometimes' : 'required';

        return $request->validate([
            'agency_id' => [$required, 'uuid', 'exists:agencies,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'category_id' => ['nullable', 'uuid', 'exists:agency_categories,id'],
            'name' => [$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'client_id' => [$required, 'uuid', 'exists:users,id'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'commercial_id' => ['nullable', 'uuid', 'exists:commercials,id'],
            'start_date' => [$required, 'date'],
            'end_date' => $update ? ['sometimes', 'date'] : ['required', 'date', 'after_or_equal:start_date'],
            'budget' => [$required, 'numeric', 'min:0'],
            'commission_type' => ['nullable', Rule::in(Prestation::COMMISSION_TYPES)],
            'commission_value' => ['nullable', 'required_with:commission_type', 'numeric', 'min:0', Rule::when($request->commission_type === 'percent', ['max:100'])],
        ]);
    }
}
