<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CommissionEntry;
use App\Models\CommissionRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

class CommissionController extends Controller
{
    #[OA\Get(path: '/api/commission-rules', summary: 'Lister les règles (dernières versions)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Règles')])]
    public function indexRules(Request $request): JsonResponse
    {
        $query = CommissionRule::query()->with(['beneficiary', 'service', 'scopeAgency', 'scopeCountry', 'scopeDepartment']);

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $latestIds = CommissionRule::query()
            ->selectRaw('DISTINCT ON (rule_group_id) id')
            ->orderBy('rule_group_id')
            ->orderByDesc('version')
            ->pluck('id');

        $rules = $query->whereIn('id', $latestIds)->orderBy('name')->get();

        return response()->json($rules);
    }

    #[OA\Post(path: '/api/commission-rules', summary: 'Créer une règle (version 1)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 201, description: 'Règle créée')])]
    public function storeRule(Request $request): JsonResponse
    {
        $data = $this->validateRulePayload($request);

        $rule = CommissionRule::create($data + [
            'rule_group_id' => (string) Str::uuid(),
            'version' => 1,
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($rule->fresh()->load(['beneficiary', 'service', 'scopeAgency', 'scopeCountry', 'scopeDepartment']), 201);
    }

    #[OA\Put(path: '/api/commission-rules/{rule}', summary: 'Modifier → nouvelle version (ancienne désactivée)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Nouvelle version')])]
    public function updateRule(Request $request, CommissionRule $rule): JsonResponse
    {
        $data = $this->validateRulePayload($request);

        $rule->update(['is_active' => false]);

        $newVersion = CommissionRule::create($data + [
            'rule_group_id' => $rule->rule_group_id,
            'version' => $rule->version + 1,
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($newVersion->fresh()->load(['beneficiary', 'service', 'scopeAgency', 'scopeCountry', 'scopeDepartment']));
    }

    #[OA\Get(path: '/api/commission-rules/{rule}/versions', summary: 'Historique des versions d\'une règle', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Versions')])]
    public function ruleVersions(CommissionRule $rule): JsonResponse
    {
        return response()->json(CommissionRule::query()->where('rule_group_id', $rule->rule_group_id)->orderByDesc('version')->get());
    }

    #[OA\Delete(path: '/api/commission-rules/{rule}', summary: 'Désactiver une règle', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Règle désactivée')])]
    public function destroyRule(CommissionRule $rule): JsonResponse
    {
        $rule->update(['is_active' => false]);

        return response()->json(['message' => 'Règle désactivée.']);
    }
#[\OA\Get(path: '/api/commissions/entries', summary: 'Lister les lignes de commission', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Entrées paginées')])]
    public function indexEntries(Request $request): JsonResponse
    {
        $query = CommissionEntry::query()->with(['invoice', 'beneficiary', 'rule', 'validator', 'payer']);

        if ($request->filled('status')) {
            $query->ofStatus($request->input('status'));
        }

        if ($request->filled('beneficiary_commercial_id')) {
            $query->where('beneficiary_commercial_id', $request->input('beneficiary_commercial_id'));
        }

        if ($request->filled('from') && $request->filled('to')) {
            $query->betweenDates($request->input('from'), $request->input('to'));
        } elseif ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from').' 00:00:00');
        } elseif ($request->filled('to')) {
            $query->where('created_at', '<=', $request->input('to').' 23:59:59');
        }

        $entries = $query->orderByDesc('created_at')->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($entries);
    }

    #[OA\Post(path: '/api/commissions/entries/{entry}/validate', summary: 'Valider (calculated → validated)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Validée')])]
    public function validateEntry(Request $request, CommissionEntry $entry): JsonResponse
    {
        abort_if(! $entry->transitionTo(CommissionEntry::STATUS_VALIDATED, $request->user()->id), 422, 'Impossible de valider cette commission (statut actuel : '.$entry->status.').');

        return response()->json($entry->fresh()->load(['invoice', 'beneficiary', 'rule', 'validator']));
    }

    #[OA\Post(path: '/api/commissions/entries/{entry}/pay', summary: 'Payer (validated → paid)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Payée')])]
    public function payEntry(Request $request, CommissionEntry $entry): JsonResponse
    {
        abort_if(! $entry->transitionTo(CommissionEntry::STATUS_PAID, $request->user()->id), 422, 'Impossible de payer cette commission (statut actuel : '.$entry->status.').');

        return response()->json($entry->fresh()->load(['invoice', 'beneficiary', 'rule', 'payer']));
    }

    #[OA\Post(path: '/api/commissions/entries/{entry}/cancel', summary: 'Annuler (calculated → cancelled)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Annulée')])]
    public function cancelEntry(Request $request, CommissionEntry $entry): JsonResponse
    {
        abort_if(! $entry->transitionTo(CommissionEntry::STATUS_CANCELLED, $request->user()->id), 422, 'Impossible d\'annuler cette commission (statut actuel : '.$entry->status.').');

        return response()->json($entry->fresh());
    }

    private function validateRulePayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'beneficiary_commercial_id' => ['nullable', 'uuid', 'exists:commercials,id'],
            'scope_country_id' => ['nullable', 'uuid', 'exists:countries,id'],
            'scope_agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
            'scope_department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'service_id' => ['nullable', 'uuid', 'exists:services,id'],
            'trigger_event' => ['required', 'string', 'in:on_sale,on_payment,on_full_payment'],
            'formula_type' => ['required', 'string', 'in:percent,fixed,tiered'],
            'percent_value' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'fixed_amount' => ['nullable', 'numeric', 'min:0'],
            'tiers_json' => ['nullable', 'array'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
        ]);
    }
}