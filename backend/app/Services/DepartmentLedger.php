<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Department;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Support\SaleBranch;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Rattachement des ventes à un département (CA, comptabilité et bilan du jour
 * « uniquement liés au département »). Chaque facture appartient à un seul
 * département de son agence :
 * - facture d'un contrat : le département du contrat (packages, prestations) ;
 * - facture d'inscription à une formation : le département Academy ;
 * - vente directe (ni contrat ni inscription) d'articles du catalogue
 *   (services, produits, quelle que soit leur catégorie : Livre, Canva…) :
 *   le département Store.
 *
 * Aucune facture n'est perdue : une vente sans article du catalogue (ligne
 * libre), ou dont l'agence n'a pas le département visé, revient au
 * département Agency de l'agence. Quand une agence a deux départements du
 * même type, le plus ancien porte les ventes (jamais compté deux fois).
 */
class DepartmentLedger
{
    /** Repli : vente sans article du catalogue, ou département absent. */
    public const FALLBACK_TYPE = Department::TYPE_AGENCY;

    /** Vente d'articles du catalogue (services, produits) : département Store. */
    public const CATALOG_TYPE = SaleBranch::CATALOG_BRANCH;

    public function departmentForInvoice(Invoice $invoice): ?string
    {
        if ($invoice->contract_id) {
            $departmentId = Contract::whereKey($invoice->contract_id)->value('department_id');
            if ($departmentId) {
                return $departmentId;
            }
        }

        if (! $invoice->agency_id) {
            return null;
        }

        if (FormationEnrollment::where('invoice_id', $invoice->id)->exists()) {
            return $this->primaryDepartmentId($invoice->agency_id, Department::TYPE_ACADEMY);
        }

        // Vente directe : département de la catégorie dominante, sinon Agency.
        [$typeSql, $bindings] = $this->directSaleTypeSql();
        $type = DB::table('invoices')
            ->where('invoices.id', $invoice->id)
            ->selectRaw("({$typeSql}) as sale_type", $bindings)
            ->value('sale_type');

        return ($type ? $this->primaryDepartmentId($invoice->agency_id, $type) : null)
            ?? $this->primaryDepartmentId($invoice->agency_id, self::FALLBACK_TYPE);
    }

    /** Sous-requête des identifiants de factures appartenant au département. */
    public function invoiceIds(Department $department): Builder
    {
        $contractInvoices = DB::table('invoices')
            ->select('invoices.id')
            ->join('contracts', 'contracts.id', '=', 'invoices.contract_id')
            ->where('contracts.department_id', $department->id);

        // Un second département du même type dans l'agence ne garde que ses
        // contrats : inscriptions et ventes directes vont au premier.
        if ($this->primaryDepartmentId($department->agency_id, $department->type) !== $department->id) {
            return $contractInvoices;
        }

        if ($department->type === Department::TYPE_ACADEMY) {
            $contractInvoices->union(
                DB::table('invoices')
                    ->select('invoices.id')
                    ->where('invoices.agency_id', $department->agency_id)
                    ->whereIn('invoices.id', DB::table('formation_enrollments')->whereNotNull('invoice_id')->select('invoice_id'))
            );
        }

        return $contractInvoices->union($this->directSales($department));
    }

    /**
     * Ventes directes de l'agence revenant à ce département : catégorie
     * dominante du type du département, et pour Agency le repli (aucun
     * article du catalogue, ou agence sans département du type visé).
     */
    private function directSales(Department $department): Builder
    {
        [$typeSql, $bindings] = $this->directSaleTypeSql();

        $query = DB::table('invoices')
            ->select('invoices.id')
            // Un contrat sans département ne rattache rien : vente directe
            // (même règle que departmentForInvoice).
            ->where(fn ($q) => $q->whereNull('invoices.contract_id')
                ->orWhereExists(fn ($c) => $c->selectRaw('1')
                    ->from('contracts')
                    ->whereColumn('contracts.id', 'invoices.contract_id')
                    ->whereNull('contracts.department_id')))
            ->where('invoices.agency_id', $department->agency_id)
            ->whereNotExists(fn ($q) => $q->selectRaw('1')
                ->from('formation_enrollments')
                ->whereColumn('formation_enrollments.invoice_id', 'invoices.id'));

        if ($department->type !== self::FALLBACK_TYPE) {
            return $query->whereRaw("({$typeSql}) = ?", [...$bindings, $department->type]);
        }

        return $query->where(fn ($q) => $q
            ->whereRaw("({$typeSql}) is null", $bindings)
            ->orWhereRaw("({$typeSql}) = ?", [...$bindings, self::FALLBACK_TYPE])
            ->orWhereNotExists(fn ($d) => $d->selectRaw('1')
                ->from('departments')
                ->whereColumn('departments.agency_id', 'invoices.agency_id')
                ->whereNull('departments.deleted_at')
                ->whereRaw("departments.type = ({$typeSql})", $bindings)));
    }

    /**
     * Type de département d'une vente directe, corrélé à `invoices.id` : Store
     * dès qu'elle contient un article du catalogue (service ou produit), null
     * si elle n'a que des lignes libres.
     *
     * @return array{0: string, 1: array<int, mixed>}
     */
    private function directSaleTypeSql(): array
    {
        return [
            "case when exists (select 1 from invoice_items catalog_items where catalog_items.invoice_id = invoices.id"
            ." and (catalog_items.service_id is not null or catalog_items.product_id is not null))"
            ." then '".self::CATALOG_TYPE."' end",
            [],
        ];
    }

    private function primaryDepartmentId(?string $agencyId, string $type): ?string
    {
        if (! $agencyId) {
            return null;
        }

        return Department::where('agency_id', $agencyId)
            ->where('type', $type)
            ->orderBy('created_at')
            ->orderBy('id')
            ->value('id');
    }
}
