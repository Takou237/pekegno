<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Setting;
use App\Services\ContractService;
use App\Services\OverdueInvoiceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * D8 : délais d'alerte de renouvellement configurables par département.
 * Lot 7 : délai de paiement (créance échue) configurable par agence.
 */
class AgencySettingsController extends Controller
{
    public function __construct(
        private readonly ContractService $contracts,
        private readonly OverdueInvoiceNotifier $overdueInvoices,
    ) {}

    public function show(Department $department): JsonResponse
    {
        return response()->json([
            'renew_alert_days' => $this->contracts->getRenewAlertDays($department->id),
            'default_renew_alert_days' => ContractService::DEFAULT_RENEW_ALERT_DAYS,
            'invoice_due_days' => $this->overdueInvoices->dueDaysForAgency($department->agency_id),
            'default_invoice_due_days' => OverdueInvoiceNotifier::DEFAULT_DUE_DAYS,
        ]);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $data = $request->validate([
            'renew_alert_days' => ['required', 'array', 'min:1', 'max:10'],
            'renew_alert_days.*' => ['integer', 'min:0', 'max:365'],
            'invoice_due_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
        ]);

        $days = array_values(array_unique(array_map('intval', $data['renew_alert_days'])));
        rsort($days);

        Setting::updateOrCreate(
            ['key' => "agency_renew_alert_days:{$department->id}"],
            ['value' => $days, 'description' => "Délais d'alerte de renouvellement — {$department->name}", 'updated_by' => $request->user()->id],
        );

        if (array_key_exists('invoice_due_days', $data) && $department->agency_id) {
            Setting::set(
                "agency_invoice_due_days:{$department->agency_id}",
                (int) $data['invoice_due_days'],
                "Délai de paiement (jours) avant créance échue — agence {$department->agency_id}",
                $request->user()->id,
            );
        }

        return $this->show($department);
    }
}
