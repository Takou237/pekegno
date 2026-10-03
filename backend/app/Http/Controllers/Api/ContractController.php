<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\ContractService as ContractServiceModel;
use App\Models\Prestation;
use App\Services\AgencyRenewalService;
use App\Services\ContractService;
use App\Services\PrestationService;
use App\Services\ScopeService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContractController extends Controller
{
    public function __construct(
        private readonly ContractService $contractService,
        private readonly PrestationService $prestationService,
        private readonly ScopeService $scope,
        private readonly AgencyRenewalService $agencyRenewals,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Contract::with([
            'client:id,first_name,last_name,email',
            'company:id,name',
            'agency:id,name',
            'department:id,name',
            'pack:id,name',
            'prestation:id,reference,name,status',
            'commercial:id,first_name,last_name',
            'services.service:id,name,code',
        ]);

        $agencyIds = $this->scope->agencyIds($request->user());
        if ($agencyIds !== null) {
            $query->whereIn('agency_id', $agencyIds);
        }

        foreach (['department_id', 'origin', 'prestation_id', 'pack_id', 'commercial_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->input($filter));
            }
        }

        if ($request->filled('agency_id')) {
            $query->ofAgency($request->input('agency_id'));
        }

        if ($request->filled('status')) {
            $query->whereIn('status', explode(',', (string) $request->input('status')));
        }

        if ($request->filled('client_id')) {
            $query->ofClient($request->input('client_id'));
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('number', 'like', "%{$s}%")
                    ->orWhereHas('client', function ($lq) use ($s) {
                        $lq->where('first_name', 'like', "%{$s}%")
                            ->orWhere('last_name', 'like', "%{$s}%");
                    });
            });
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $contracts = $query->orderByDesc('start_date')->paginate($perPage);

        return response()->json($contracts);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'uuid', 'exists:users,id'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'agency_id' => ['required', 'uuid', 'exists:agencies,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'pack_id' => ['nullable', 'uuid', 'exists:subscription_packs,id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'billing_cycle' => ['sometimes', 'string', 'in:one_shot,monthly,quarterly,yearly'],
            'amount' => ['required', 'numeric', 'min:0'],
            'auto_renew' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'services' => ['sometimes', 'array'],
            'services.*.service_id' => ['required', 'uuid', 'exists:services,id'],
            'services.*.price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $contract = DB::transaction(function () use ($data, $request) {
            $contract = Contract::create([
                'number' => $this->contractService->generateNextNumber(),
                'client_id' => $data['client_id'],
                'company_id' => $data['company_id'] ?? null,
                'agency_id' => $data['agency_id'],
                'department_id' => $data['department_id'] ?? null,
                'pack_id' => $data['pack_id'] ?? null,
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'billing_cycle' => $data['billing_cycle'] ?? 'monthly',
                'amount' => $data['amount'],
                'status' => Contract::STATUS_ACTIVE,
                'auto_renew' => $data['auto_renew'] ?? false,
                'notes' => $data['notes'] ?? null,
            ]);

            if (! empty($data['services'])) {
                foreach ($data['services'] as $serviceData) {
                    ContractServiceModel::create([
                        'contract_id' => $contract->id,
                        'service_id' => $serviceData['service_id'],
                        'price' => $serviceData['price'] ?? null,
                    ]);
                }
            }

            return $contract;
        });

        return response()->json(
            $contract->fresh()->load([
                'client:id,first_name,last_name,email',
                'company:id,name',
                'agency:id,name',
                'department:id,name',
                'pack:id,name',
                'services.service:id,name,code',
            ]),
            201
        );
    }

    public function show(Contract $contract): JsonResponse
    {
        $contract->load([
            'client:id,first_name,last_name,email',
            'company:id,name',
            'agency:id,name',
            'department:id,name',
            'pack:id,name',
            'parentContract:id,number',
            'childContracts:id,number,status,parent_contract_id',
            'services.service:id,name,code,price',
            'prestation:id,reference,name,status,budget',
            'commercial:id,first_name,last_name',
            'invoices.payments',
        ]);

        return response()->json($contract);
    }

    public function update(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate([
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'start_date' => ['sometimes', 'date'],
            'end_date' => ['sometimes', 'date', 'after_or_equal:start_date'],
            'billing_cycle' => ['sometimes', 'string', 'in:one_shot,monthly,quarterly,yearly'],
            'amount' => ['sometimes', 'numeric', 'min:0'],
            'auto_renew' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'status' => ['sometimes', 'string', 'in:active,suspended,pending,draft'],
            'services' => ['sometimes', 'array'],
            'services.*.service_id' => ['required', 'uuid', 'exists:services,id'],
            'services.*.price' => ['nullable', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($contract, $data) {
            $contract->update(collect($data)->except('services')->toArray());

            if (isset($data['services'])) {
                $contract->services()->delete();
                foreach ($data['services'] as $serviceData) {
                    ContractServiceModel::create([
                        'contract_id' => $contract->id,
                        'service_id' => $serviceData['service_id'],
                        'price' => $serviceData['price'] ?? null,
                    ]);
                }
            }
        });

        return response()->json(
            $contract->fresh()->load([
                'client:id,first_name,last_name,email',
                'company:id,name',
                'agency:id,name',
                'department:id,name',
                'pack:id,name',
                'services.service:id,name,code,price',
            ])
        );
    }

    public function renew(Request $request, Contract $contract): JsonResponse
    {
        abort_if(in_array($contract->status, [Contract::STATUS_RENEWED, Contract::STATUS_TERMINATED], true), 422, 'Ce contrat ne peut plus être renouvelé.');

        $newContract = in_array($contract->origin, [Contract::ORIGIN_PACKAGE, Contract::ORIGIN_PRESTATION], true)
            ? $this->agencyRenewals->renew($contract, $request->user()?->id)
            : $this->contractService->renew($contract);

        return response()->json(
            $newContract->load([
                'client:id,first_name,last_name,email',
                'company:id,name',
                'agency:id,name',
                'department:id,name',
                'pack:id,name',
                'services.service:id,name,code,price',
            ]),
            201
        );
    }

    public function terminate(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $contract = DB::transaction(function () use ($contract, $data) {
            $contract = $this->contractService->terminate($contract, $data['reason']);

            // La prestation liée est annulée avec le même motif.
            $prestation = $contract->prestation_id ? Prestation::find($contract->prestation_id) : null;
            if ($prestation && $prestation->canTransitionTo(Prestation::STATUS_CANCELLED)) {
                $this->prestationService->transition($prestation, Prestation::STATUS_CANCELLED, $data['reason']);
            }

            return $contract;
        });

        return response()->json(
            $contract->load([
                'client:id,first_name,last_name,email',
                'company:id,name',
                'agency:id,name',
                'department:id,name',
                'pack:id,name',
                'services.service:id,name,code,price',
            ])
        );
    }

    public function suspend(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']]);

        return response()->json($this->contractService->suspend($contract, $data['reason']));
    }

    public function resume(Contract $contract): JsonResponse
    {
        abort_unless($contract->status === Contract::STATUS_SUSPENDED, 422, "Le contrat n'est pas suspendu.");

        return response()->json($this->contractService->resume($contract));
    }

    /** Dépôt du PDF signé (facultatif, D10). Le fichier est d'abord envoyé via /uploads. */
    public function sign(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate([
            'signed_document_path' => ['required', 'string', 'max:2048'],
            'signed_at' => ['nullable', 'date'],
        ]);

        $contract->update([
            'signed_document_path' => $data['signed_document_path'],
            'signed_at' => $data['signed_at'] ?? now(),
        ]);

        return response()->json($contract->fresh());
    }

    /** PDF du contrat : Pekegno (agence) · client · prestation / package · budget. */
    public function pdf(Contract $contract): Response
    {
        $contract->load([
            'client:id,first_name,last_name,email,phone,address',
            'company:id,name',
            'agency:id,name,city,address,phone,email',
            'pack:id,name,tagline',
            'pack.items',
            'prestation:id,reference,name,description,budget,start_date,end_date',
            'prestation.actions',
            'commercial:id,first_name,last_name',
            'invoices',
        ]);

        return Pdf::loadView('pdf.contract', ['contract' => $contract])->download("contrat-{$contract->number}.pdf");
    }
}
