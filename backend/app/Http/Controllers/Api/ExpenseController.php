<?php

namespace App\Http\Controllers\Api;

use App\Services\ScopeService;
use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Service;
use App\Services\ExpenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ExpenseController extends Controller
{
    public function __construct(private readonly ExpenseService $expenseService) {}

    #[OA\Get(
        path: '/api/expenses',
        summary: 'Lister les dépenses (filtres + pagination)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected', 'paid', 'closed'])),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Expense::query()->with(['agency', 'country:id,name', 'category', 'requestor']);
        $user = $request->user();
        $scope = app(ScopeService::class);

        // Périmètre : un encadrant ne voit que ses agences ; l'Administration
        // (direction rattachée à un pays, comptable) voit en plus les dépenses
        // de l'Administration de son pays (elles n'ont pas d'agence).
        if ($scope->isAgencyScoped($user)) {
            $agencyIds = $scope->agencyIds($user);
            $administration = in_array($user?->role?->name, self::ADMINISTRATION_ROLES, true);

            $query->where(function ($q) use ($scope, $user, $agencyIds, $administration) {
                if ($agencyIds !== null) {
                    $q->whereIn('agency_id', $agencyIds);
                }

                if ($administration && $agencyIds !== null) {
                    $q->orWhere(fn ($sub) => $sub
                        ->whereNull('agency_id')
                        ->whereIn('country_id', $scope->countryIds($user) ?? []));
                }
            });
        }

        // Dépenses de l'Administration d'un pays (sans agence).
        if ($request->boolean('administration')) {
            $query->whereNull('agency_id')->whereNotNull('country_id');
        }
        if ($request->filled('country_id')) {
            $query->where('country_id', $request->input('country_id'));
        }

        if ($request->filled('status')) {
            $query->ofStatus($request->input('status'));
        }

        if ($request->filled('agency_id')) {
            $query->ofAgency($request->input('agency_id'));
        }

        if ($request->filled('from') && $request->filled('to')) {
            $query->betweenDates($request->input('from'), $request->input('to'));
        } elseif ($request->filled('from')) {
            $query->where('expense_date', '>=', $request->input('from'));
        } elseif ($request->filled('to')) {
            $query->where('expense_date', '<=', $request->input('to'));
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(fn ($q) => $q->where('number', 'like', "%{$s}%")->orWhere('note', 'like', "%{$s}%"));
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $expenses = $query->orderByDesc('expense_date')->paginate($perPage);

        return response()->json($expenses);
    }

    #[OA\Post(
        path: '/api/expenses',
        summary: 'Créer une dépense (draft)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Dépense créée'),
            new OA\Response(response: 422, description: 'Validation échouée'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            // Agence, OU Administration d'un pays (country_id, sans agence).
            'agency_id' => ['required_without:country_id', 'nullable', 'uuid', 'exists:agencies,id'],
            'country_id' => ['required_without:agency_id', 'nullable', 'uuid', 'exists:countries,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'category_id' => ['required', 'uuid', 'exists:accounting_categories,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'expense_date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            'justification_path' => ['nullable', 'string', 'max:255'],
            // T3.12 — dépense financée par le budget pub d'une facture client.
            'invoice_id' => ['nullable', 'uuid', 'exists:invoices,id'],
            'is_pass_through' => ['sometimes', 'boolean'],
            // T3.14 — événement (séminaire vendu) dont relève la dépense.
            'service_id' => ['nullable', 'uuid', 'exists:services,id'],
        ]);

        $data = $this->administrationAttributes($data, $request);
        $data = $this->passThroughAttributes($data);
        $data = $this->eventAttributes($data);

        $expense = Expense::create($data + [
            'number' => Expense::generateNextNumber(),
            'status' => Expense::STATUS_DRAFT,
            'requested_by' => $request->user()->id,
        ]);

        return response()->json($expense->fresh()->load(['agency', 'country:id,name', 'category', 'requestor', 'department']), 201);
    }

    /** Rôles qui saisissent les dépenses de l'Administration d'un pays. */
    public const ADMINISTRATION_ROLES = ['super-admin', 'direction-generale', 'comptable'];

    /**
     * Cahier §2 : dépense de l'Administration d'un pays (frais d'administration,
     * publicité Pekegno, stock de livres et de Matootoo) — sans agence ni
     * département. Saisie par l'administration centrale et le comptable.
     */
    private function administrationAttributes(array $data, Request $request): array
    {
        if (! empty($data['agency_id'])) {
            unset($data['country_id']);

            return $data;
        }

        abort_unless(
            in_array($request->user()?->role?->name, self::ADMINISTRATION_ROLES, true),
            403,
            "Seuls l'administrateur, la direction générale et le comptable saisissent les dépenses de l'Administration."
        );
        $data['agency_id'] = null;
        $data['department_id'] = null;

        return $data;
    }

    /**
     * T3.12 — une dépense de budget pub client est toujours rattachée à la
     * facture qui la finance ; le drapeau en découle, il n'est pas libre.
     * Elle sort des dépenses d'exploitation (seuls les honoraires comptent).
     */
    private function passThroughAttributes(array $data, ?Expense $expense = null): array
    {
        $invoiceId = $data['invoice_id'] ?? $expense?->invoice_id;
        $requested = array_key_exists('is_pass_through', $data)
            ? (bool) $data['is_pass_through']
            : (bool) ($expense?->is_pass_through ?? false);

        if ($invoiceId === null) {
            abort_if($requested, 422, 'Indiquez la facture client dont le budget publicitaire finance cette dépense.');
            $data['is_pass_through'] = false;

            return $data;
        }

        $invoice = Invoice::find($invoiceId);
        abort_if(! $invoice, 422, 'Facture client introuvable.');
        abort_if(
            isset($data['agency_id']) && $invoice->agency_id !== $data['agency_id'],
            422,
            "La facture du budget publicitaire n'appartient pas à cette agence."
        );
        abort_unless(
            $invoice->items()->where('is_pass_through', true)->exists(),
            422,
            'Cette facture ne porte pas de budget publicitaire client.'
        );

        $data['is_pass_through'] = true;

        return $data;
    }

    /** T3.14 — un événement est le séminaire vendu au catalogue. */
    private function eventAttributes(array $data, ?Expense $expense = null): array
    {
        $serviceId = $data['service_id'] ?? $expense?->service_id;
        if ($serviceId === null) {
            return $data;
        }

        $service = Service::find($serviceId);
        abort_if(! $service, 422, 'Séminaire introuvable.');

        $agencyId = $data['agency_id'] ?? $expense?->agency_id;
        abort_if(
            $agencyId !== null && $service->agency_id !== null && $service->agency_id !== $agencyId,
            422,
            "Le séminaire rattaché n'appartient pas à cette agence."
        );

        return $data;
    }

    #[OA\Get(
        path: '/api/expenses/{expense}',
        summary: 'Détail d\'une dépense avec historique',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Détail'),
        ]
    )]
    public function show(Expense $expense): JsonResponse
    {
        return response()->json($expense->load([
            'agency', 'country:id,name', 'category', 'requestor', 'approver', 'rejector', 'payer', 'treasuryAccount', 'department',
        ]));
    }

    #[OA\Put(
        path: '/api/expenses/{expense}',
        summary: 'Modifier une dépense (draft seulement)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Dépense modifiée'),
            new OA\Response(response: 422, description: 'Modification interdite hors draft'),
        ]
    )]
    public function update(Request $request, Expense $expense): JsonResponse
    {
        abort_if($expense->status !== Expense::STATUS_DRAFT, 422, 'Seule une dépense en brouillon peut être modifiée.');

        $data = $request->validate([
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'category_id' => ['required', 'uuid', 'exists:accounting_categories,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'expense_date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            'justification_path' => ['nullable', 'string', 'max:255'],
            'invoice_id' => ['nullable', 'uuid', 'exists:invoices,id'],
            'is_pass_through' => ['sometimes', 'boolean'],
            'service_id' => ['nullable', 'uuid', 'exists:services,id'],
        ]);

        $data = $this->passThroughAttributes($data, $expense);
        $data = $this->eventAttributes($data, $expense);

        $expense->update($data);

        return response()->json($expense->fresh()->load(['agency', 'country:id,name', 'category', 'requestor']));
    }
#[OA\Post(
        path: '/api/expenses/{expense}/submit',
        summary: 'Soumettre une dépense (draft → submitted)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Soumise'),
            new OA\Response(response: 422, description: 'Transition interdite'),
        ]
    )]
    /**
     * Justificatif (CdC §14) : photo ou PDF du reçu, joint à tout moment du
     * circuit (demande, validation, décaissement). Remplace le précédent.
     */
    public function uploadJustification(Expense $expense, Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,heic,pdf', 'max:8192'],
        ]);

        $user = $request->user();
        abort_unless(
            collect(['depenses.creer', 'depenses.modifier', 'depenses.valider', 'depenses.encaisser'])->contains(fn ($p) => $user->hasPermission($p)),
            403,
            'Vous ne pouvez pas joindre de justificatif.'
        );
        $scope = app(ScopeService::class);
        if ($scope->isAgencyScoped($user)) {
            $agencyIds = $scope->agencyIds($user);
            $inScope = $agencyIds === null
                ? true
                : ($expense->agency_id !== null
                    ? in_array($expense->agency_id, $agencyIds, true)
                    : in_array($expense->country_id, $scope->countryIds($user) ?? [], true));
            abort_unless($inScope, 404);
        }

        $previous = $expense->justification_path;
        $path = $request->file('file')->store('expense-justifications', 'public');
        $expense->update(['justification_path' => $path]);

        if ($previous && $previous !== $path && ! str_starts_with($previous, 'http')) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($previous);
        }

        return response()->json($expense->fresh()->load(['agency', 'country:id,name', 'category', 'requestor', 'department']));
    }

    public function submit(Expense $expense, Request $request): JsonResponse
    {
        $expense = $this->expenseService->submit($expense, $request->user()->id);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor']));
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/approve',
        summary: 'Approuver une dépense (submitted → approved)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Approuvée'),
            new OA\Response(response: 422, description: 'Transition interdite'),
        ]
    )]
    public function approve(Expense $expense, Request $request): JsonResponse
    {
        $expense = $this->expenseService->approve($expense, $request->user()->id);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor', 'approver']));
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/reject',
        summary: 'Rejeter une dépense (submitted → rejected, raison requise)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Rejetée'),
            new OA\Response(response: 422, description: 'Raison manquante ou transition interdite'),
        ]
    )]
    public function reject(Request $request, Expense $expense): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $expense = $this->expenseService->reject($expense, $data['reason'], $request->user()->id);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor', 'rejector']));
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/pay',
        summary: 'Payer une dépense (approved → paid, sortie trésorerie + écriture comptable)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Payée'),
            new OA\Response(response: 422, description: 'Compte invalide ou transition interdite'),
        ]
    )]
    public function pay(Request $request, Expense $expense): JsonResponse
    {
        $data = $request->validate([
            'treasury_account_id' => ['required', 'uuid', 'exists:treasury_accounts,id'],
        ]);

        $expense = $this->expenseService->pay($expense, $data['treasury_account_id'], $request->user()->id);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor', 'approver', 'payer', 'treasuryAccount']));
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/close',
        summary: 'Clôturer une dépense (paid → closed)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Clôturée'),
            new OA\Response(response: 422, description: 'Transition interdite'),
        ]
    )]
    public function close(Expense $expense, Request $request): JsonResponse
    {
        $expense = $this->expenseService->close($expense, $request->user()->id);

        return response()->json($expense->fresh());
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/reopen',
        summary: 'Rouvrir une dépense rejetée (rejected → draft)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Rouverte'),
            new OA\Response(response: 422, description: 'Dépense non rejetée'),
        ]
    )]
    public function reopen(Expense $expense, Request $request): JsonResponse
    {
        $expense = $this->expenseService->reopen($expense, $request->user()->id);

        return response()->json($expense->fresh());
    }

    #[OA\Delete(
        path: '/api/expenses/{expense}',
        summary: 'Supprimer une dépense (draft ou rejetée seulement)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Supprimée'),
            new OA\Response(response: 422, description: 'Suppression interdite dans cet état'),
        ]
    )]
    public function destroy(Expense $expense): JsonResponse
    {
        abort_if(! in_array($expense->status, [Expense::STATUS_DRAFT, Expense::STATUS_REJECTED], true), 422, 'Seule une dépense en brouillon ou rejetée peut être supprimée.');

        $expense->delete();

        return response()->json(null, 204);
    }
}