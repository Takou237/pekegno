<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Department;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Rattachement des ventes à un département (comptabilité et bilan du jour
 * « uniquement liés au département ») :
 * - Agency : factures des contrats du département (packages / prestations) ;
 * - Academy : factures d'inscription aux formations de l'agence du département.
 */
class DepartmentLedger
{
    public function departmentForInvoice(Invoice $invoice): ?string
    {
        if ($invoice->contract_id) {
            $departmentId = Contract::whereKey($invoice->contract_id)->value('department_id');
            if ($departmentId) {
                return $departmentId;
            }
        }

        if ($invoice->agency_id && FormationEnrollment::where('invoice_id', $invoice->id)->exists()) {
            return Department::where('agency_id', $invoice->agency_id)
                ->where('type', Department::TYPE_ACADEMY)
                ->orderBy('created_at')
                ->value('id');
        }

        return null;
    }

    /** Sous-requête des identifiants de factures appartenant au département. */
    public function invoiceIds(Department $department): Builder
    {
        $contractInvoices = DB::table('invoices')
            ->select('invoices.id')
            ->join('contracts', 'contracts.id', '=', 'invoices.contract_id')
            ->where('contracts.department_id', $department->id);

        if ($department->type !== Department::TYPE_ACADEMY) {
            return $contractInvoices;
        }

        return $contractInvoices->union(
            DB::table('invoices')
                ->select('invoices.id')
                ->where('invoices.agency_id', $department->agency_id)
                ->whereIn('invoices.id', DB::table('formation_enrollments')->whereNotNull('invoice_id')->select('invoice_id'))
        );
    }
}
