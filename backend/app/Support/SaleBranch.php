<?php

namespace App\Support;

use App\Models\Department;

/**
 * Rubrique et branche d'une ligne de facture : une seule règle pour toutes
 * les pages (B4, B24, rubriques du Lot 3). Un même article est donc toujours
 * classé pareil, au tableau de bord, au Bilan du jour, en Comptabilité, au
 * Suivi des ventes ou dans le CA d'un département (DepartmentLedger).
 *
 * Rubriques :
 * - « Academy » : lignes d'une facture d'inscription à une formation ;
 * - « Agency » : packages et prestations ;
 * - « Séminaire » : tout service coché « Service séminaire (Pass) », quelle
 *   que soit sa catégorie ;
 * - sinon, la catégorie du service ou du produit (Livre, Canva…) : créer une
 *   catégorie crée sa rubrique. Branche Store ;
 * - « Sans catégorie » : ligne libre hors inscription, ou article sans
 *   catégorie.
 *
 * Usage : SaleBranch::joinCatalog($query) sur une requête qui joint déjà
 * `invoice_items` et `invoices`, puis SaleBranch::categorySql() /
 * SaleBranch::branchSql() dans un select, un group by ou un where.
 */
final class SaleBranch
{
    public const OTHER = 'other';

    public const UNCATEGORIZED = 'Sans catégorie';

    /** Rubriques fixes, présentes même sans vente. */
    public const ACADEMY = 'Academy';

    public const AGENCY = 'Agency';

    public const SEMINAR = 'Séminaire';

    public const DEFAULT_RUBRICS = [self::ACADEMY, self::AGENCY, self::SEMINAR];

    /** Budget publicitaire client (pass-through) : ni CA ni rubrique de vente. */
    public const PASS_THROUGH = 'Budget pub client';

    /** Branche de tout article du catalogue (services, produits). */
    public const CATALOG_BRANCH = Department::TYPE_STORE;

    public const BRANCHES = [
        Department::TYPE_ACADEMY,
        Department::TYPE_AGENCY,
        Department::TYPE_STORE,
        Department::TYPE_STUDIO,
        self::OTHER,
    ];

    /** Jointures nécessaires à categorySql() / branchSql() (alias préfixés sb_). */
    public static function joinCatalog($query)
    {
        return $query
            ->leftJoin('services as sb_services', 'sb_services.id', '=', 'invoice_items.service_id')
            ->leftJoin('categories as sb_service_categories', 'sb_service_categories.id', '=', 'sb_services.category_id')
            ->leftJoin('categories as sb_item_categories', 'sb_item_categories.id', '=', 'invoice_items.category_id')
            ->leftJoin('products as sb_products', 'sb_products.id', '=', 'invoice_items.product_id')
            ->leftJoin('categories as sb_product_categories', 'sb_product_categories.id', '=', 'sb_products.category_id')
            ->leftJoin('subscription_packs as sb_packs', 'sb_packs.id', '=', 'invoice_items.package_id')
            ->leftJoin('prestations as sb_prestations', 'sb_prestations.id', '=', 'invoice_items.prestation_id')
            ->leftJoin('agency_categories as sb_agency_categories', 'sb_agency_categories.id', '=', \Illuminate\Support\Facades\DB::raw('coalesce(sb_packs.category_id, sb_prestations.category_id)'));
    }

    public static function categorySql(): string
    {
        return "case
            when invoice_items.package_id is not null or invoice_items.prestation_id is not null then '".self::AGENCY."'
            when sb_services.is_seminar then '".self::SEMINAR."'
            when invoice_items.service_id is not null or invoice_items.product_id is not null
                then coalesce(sb_item_categories.name, sb_service_categories.name, sb_product_categories.name, '".self::UNCATEGORIZED."')
            when ".self::enrollmentExistsSql()." then '".self::ACADEMY."'
            else '".self::UNCATEGORIZED."' end";
    }

    public static function branchSql(): string
    {
        return "case
            when invoice_items.package_id is not null or invoice_items.prestation_id is not null then '".Department::TYPE_AGENCY."'
            when invoice_items.service_id is not null or invoice_items.product_id is not null then '".self::CATALOG_BRANCH."'
            when ".self::enrollmentExistsSql()." then '".Department::TYPE_ACADEMY."'
            else '".self::OTHER."' end";
    }

    private static function enrollmentExistsSql(): string
    {
        return 'exists (select 1 from formation_enrollments sb_enrollments where sb_enrollments.invoice_id = invoice_items.invoice_id)';
    }
}
