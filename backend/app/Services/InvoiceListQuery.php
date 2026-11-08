<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Requête de base de la liste des factures, partagée avec les tableaux de bord (B3).
 *
 * Le tableau de bord ne comptait que les factures validées, alors que la liste
 * affiche toutes les factures non annulées : deux chiffres pour la même période
 * (cahier client — 02/11 : 5 factures au tableau de bord « Hier » contre 10 dans
 * la liste, et 0 facture à Yaoundé dont les deux ventes étaient en attente).
 *
 * Un seul point d'entrée ici :
 * - le périmètre de rôle, identique à celui de `InvoiceController::index` ;
 * - les factures non annulées ;
 * - les bornes de la journée métier (`Period::from/to`), et non les bornes UTC.
 *
 * Ainsi le tableau de bord et la liste comptent exactement la même chose.
 */
class InvoiceListQuery
{
    public function __construct(private readonly ScopeService $scope) {}

    /**
     * Base de la liste : périmètre de rôle de l'utilisateur connecté.
     */
    public function base(?User $user): Builder
    {
        $query = Invoice::query();

        if (! $user) {
            return $query->whereRaw('1 = 0');
        }

        // Un commercial (ou community-manager) n'accède qu'à ses propres factures
        // (liste et totaux) : rattachées à sa fiche, ou dont il est vendeur / créateur
        // (ventes saisies avant la création de sa fiche vendeur).
        if ($user->actsAsCommercial()) {
            return $query->where(fn ($q) => $this->ownSales($q, $user));
        }

        // Un caissier ne voit que les factures rattachées à ses agences affectées.
        if ($user->role?->name === 'caissier') {
            $agencyIds = DB::table('user_assignments')
                ->where('user_id', $user->id)
                ->whereNotNull('agency_id')
                ->pluck('agency_id')
                ->all();

            return $query->whereIn('invoices.agency_id', $agencyIds);
        }

        // Chefs d'agence / de département, directeur général rattaché à un pays :
        // uniquement les factures de leur périmètre (agences de leur espace),
        // plus leurs propres ventes : comme un commercial, ils peuvent vendre
        // pour une autre agence et doivent pouvoir suivre / encaisser ces factures.
        if (in_array($user->role?->name, ['responsable-agence', 'responsable-departement', 'direction-generale'], true)) {
            $agencyIds = $this->scope->agencyIds($user);
            if ($agencyIds !== null) {
                return $query->where(function ($q) use ($agencyIds, $user) {
                    $q->whereIn('invoices.agency_id', $agencyIds)
                        ->orWhere(fn ($inner) => $this->ownSales($inner, $user));
                });
            }
        }

        return $query;
    }

    /** Ventes de l'utilisateur : vendeur, créateur ou commercial rattaché, toutes agences. */
    public function ownSales($query, User $user)
    {
        $profileId = $user->commercialProfile?->id;

        return $query->where('invoices.seller_user_id', $user->id)
            ->orWhere('invoices.created_by', $user->id)
            ->when($profileId, fn ($q) => $q->orWhere('invoices.commercial_id', $profileId));
    }

    /**
     * Factures de la période, exactement comme la liste des factures : non
     * annulées, avec les mêmes bornes que la requête standard.
     *
     * Utilise les mêmes bornes `from`/`to` que `Period::from()`/`Period::to()`,
     * ce qui assure la cohérence avec la liste des factures.
     *
     * @param  array<int, string>|null  $agencyIds  périmètre supplémentaire (niveau pays / ville / agence)
     */
    public function forPeriod(?User $user, Carbon $from, Carbon $to, ?array $agencyIds = null, ?Department $department = null): Builder
    {
        return $this->base($user)
            ->whereNull('invoices.cancelled_at')
            ->whereBetween('invoices.invoice_date', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds ?: ['00000000-0000-0000-0000-000000000000']))
            ->when($department, fn ($q) => $q->whereIn(
                'invoices.id',
                DB::query()
                    ->fromSub(app(DepartmentLedger::class)->invoiceIds($department), 'dept_invoices')
                    ->select('dept_invoices.id')
            ));
    }

    /**
     * Compteurs de la période : total (comme la liste), validées, en attente,
     * rejetées et soldées.
     *
     * @param  array<int, string>|null  $agencyIds
     * @return array{total: int, validated: int, pending: int, rejected: int, paid: int}
     */
    public function counts(?User $user, Carbon $from, Carbon $to, ?array $agencyIds = null, ?Department $department = null): array
    {
        $row = $this->forPeriod($user, $from, $to, $agencyIds, $department)
            ->selectRaw(
                'count(*) as total, '
                ."coalesce(sum(case when invoices.validation_status = '".Invoice::VALIDATION_VALIDATED."' then 1 else 0 end), 0) as validated, "
                ."coalesce(sum(case when invoices.validation_status = '".Invoice::VALIDATION_PENDING."' then 1 else 0 end), 0) as pending, "
                ."coalesce(sum(case when invoices.validation_status = '".Invoice::VALIDATION_REJECTED."' then 1 else 0 end), 0) as rejected, "
                .'coalesce(sum(case when invoices.amount_paid >= invoices.total_amount then 1 else 0 end), 0) as paid'
            )
            ->first();

        return [
            'total' => (int) ($row->total ?? 0),
            'validated' => (int) ($row->validated ?? 0),
            'pending' => (int) ($row->pending ?? 0),
            'rejected' => (int) ($row->rejected ?? 0),
            'paid' => (int) ($row->paid ?? 0),
        ];
    }

    /**
     * Compteurs par agence, pour la navigation d'un tableau de bord : une seule
     * requête, mêmes filtres que la liste.
     *
     * @return Collection<string, array{total: int, paid: int}>
     */
    public function countsByAgency(?User $user, Carbon $from, Carbon $to): Collection
    {
        return $this->forPeriod($user, $from, $to)
            ->groupBy('invoices.agency_id')
            ->selectRaw(
                'invoices.agency_id, count(*) as total, '
                .'coalesce(sum(case when invoices.amount_paid >= invoices.total_amount then 1 else 0 end), 0) as paid'
            )
            ->get()
            ->mapWithKeys(fn ($row) => [
                $row->agency_id => ['total' => (int) $row->total, 'paid' => (int) $row->paid],
            ]);
    }
}
