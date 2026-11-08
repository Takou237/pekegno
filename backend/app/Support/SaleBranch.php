<?php

namespace App\Support;

use App\Models\Department;

/**
 * Catégorie et branche d'une ligne de facture : une seule règle pour toutes
 * les pages (B4, B24). Un même article est donc toujours classé pareil, que
 * ce soit au tableau de bord, au Suivi des ventes ou dans le CA d'un
 * département (DepartmentLedger).
 *
 * - package ou prestation : branche Agency, catégorie Agency du pack / de la
 *   prestation ;
 * - service ou produit du catalogue : catégorie du catalogue ; la branche est
 *   le type de département que nomme cette catégorie (« Academy », « Store »,
 *   « Studio », « Agency »), sinon Store, le catalogue de la boutique (Livre,
 *   Canva…) ;
 * - ligne libre d'une facture d'inscription : la formation, branche Academy ;
 * - autre ligne libre : « Sans catégorie », branche « other ».
 *
 * Usage : SaleBranch::joinCatalog($query) sur une requête qui joint déjà
 * `invoice_items` et `invoices`, puis SaleBranch::categorySql() /
 * SaleBranch::branchSql() dans un select, un group by ou un where.
 */
final class SaleBranch
{
    public const OTHER = 'other';

    public const UNCATEGORIZED = 'Sans catégorie';

    public const FORMATIONS = 'Formations';

    /** Catégorie du catalogue qui ne nomme aucun type de département. */
    public const DEFAULT_CATALOG_BRANCH = Department::TYPE_STORE;

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
            ->leftJoin('products as sb_products', 'sb_products.id', '=', 'invoice_items.product_id')
            ->leftJoin('categories as sb_product_categories', 'sb_product_categories.id', '=', 'sb_products.category_id')
            ->leftJoin('subscription_packs as sb_packs', 'sb_packs.id', '=', 'invoice_items.package_id')
            ->leftJoin('prestations as sb_prestations', 'sb_prestations.id', '=', 'invoice_items.prestation_id')
            ->leftJoin('agency_categories as sb_agency_categories', 'sb_agency_categories.id', '=', \Illuminate\Support\Facades\DB::raw('coalesce(sb_packs.category_id, sb_prestations.category_id)'));
    }

    public static function categorySql(): string
    {
        return "case
            when invoice_items.package_id is not null or invoice_items.prestation_id is not null
                then coalesce(sb_agency_categories.name, 'Agency')
            when invoice_items.service_id is not null or invoice_items.product_id is not null
                then coalesce(sb_service_categories.name, sb_product_categories.name, '".self::UNCATEGORIZED."')
            when ".self::enrollmentExistsSql()." then '".self::FORMATIONS."'
            else '".self::UNCATEGORIZED."' end";
    }

    public static function branchSql(): string
    {
        return "case
            when invoice_items.package_id is not null or invoice_items.prestation_id is not null then '".Department::TYPE_AGENCY."'
            when invoice_items.service_id is not null or invoice_items.product_id is not null
                then ".self::catalogBranchSql('coalesce(sb_service_categories.name, sb_product_categories.name)')."
            when ".self::enrollmentExistsSql()." then '".Department::TYPE_ACADEMY."'
            else '".self::OTHER."' end";
    }

    /** Branche d'une catégorie du catalogue (nom SQL donné). */
    public static function catalogBranchSql(string $categoryNameSql): string
    {
        $name = "lower(coalesce({$categoryNameSql}, ''))";
        $whens = implode(' ', array_map(
            fn (string $type) => "when {$name} = '{$type}' then '{$type}'",
            [Department::TYPE_ACADEMY, Department::TYPE_AGENCY, Department::TYPE_STORE, Department::TYPE_STUDIO]
        ));

        return "(case {$whens} else '".self::DEFAULT_CATALOG_BRANCH."' end)";
    }

    private static function enrollmentExistsSql(): string
    {
        return 'exists (select 1 from formation_enrollments sb_enrollments where sb_enrollments.invoice_id = invoice_items.invoice_id)';
    }
}
