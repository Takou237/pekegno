<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Product;
use App\Models\Service;
use App\Models\SubscriptionPack;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Comptabilité par élément du catalogue : chaque produit, prestation,
 * formation et package (y compris ceux créés après coup, sans vente) avec
 * la quantité vendue, le montant facturé et l'argent encaissé ventilé par
 * moyen de paiement.
 *
 * Un encaissement est réparti entre les lignes de sa facture au prorata de
 * leur montant (prix promotionnel / remise inclus) : la somme des lignes
 * égale toujours la somme encaissée.
 */
class CatalogRevenueService
{
    public const KINDS = ['product', 'service', 'course', 'package'];

    /**
     * @param  array<int, string>|null  $agencyIds  null = toutes les agences
     * @return array{rows: array<int, array<string, mixed>>, totals: array<string, mixed>}
     */
    public function report(Carbon $from, Carbon $to, ?array $agencyIds): array
    {
        $rows = $this->catalog($agencyIds);
        $empty = fn () => ['quantity' => 0, 'billed' => 0.0, 'collected' => 0.0, 'by_mode' => array_fill_keys(RevenueService::MODES, 0.0), 'payments' => 0];

        foreach ($rows as $key => $row) {
            $rows[$key] += $empty();
        }

        $other = ['key' => 'other', 'kind' => 'other', 'id' => null, 'name' => 'Autres (libellés libres)', 'category' => null] + $empty();

        $this->addSales($rows, $other, $from, $to, $agencyIds);
        $this->addCollections($rows, $other, $from, $to, $agencyIds);

        if ($other['quantity'] > 0 || $other['collected'] > 0) {
            $rows['other'] = $other;
        }

        $rows = collect($rows)
            ->map(fn (array $r) => array_merge($r, [
                'billed' => round($r['billed'], 2),
                'collected' => round($r['collected'], 2),
                'by_mode' => array_map(fn ($v) => round($v, 2), $r['by_mode']),
            ]))
            ->sortBy([['collected', 'desc'], ['name', 'asc']])
            ->values();

        $byMode = array_fill_keys(RevenueService::MODES, 0.0);
        foreach ($rows as $r) {
            foreach ($r['by_mode'] as $mode => $value) {
                $byMode[$mode] += $value;
            }
        }

        return [
            'rows' => $rows->all(),
            'totals' => [
                'quantity' => $rows->sum('quantity'),
                'billed' => round($rows->sum('billed'), 2),
                'collected' => round($rows->sum('collected'), 2),
                'by_mode' => array_map(fn ($v) => round($v, 2), $byMode),
            ],
        ];
    }

    /**
     * Catalogue du périmètre : éléments globaux (sans agence) + ceux des agences.
     *
     * @return array<string, array<string, mixed>>
     */
    private function catalog(?array $agencyIds): array
    {
        $inScope = fn ($q) => $agencyIds === null ? $q : $q->where(fn ($w) => $w->whereNull('agency_id')->orWhereIn('agency_id', $agencyIds));
        $rows = [];

        foreach ($inScope(Product::query()->with('category:id,name'))->orderBy('name')->get() as $p) {
            $rows["product:{$p->id}"] = ['key' => "product:{$p->id}", 'kind' => 'product', 'id' => $p->id, 'name' => $p->name, 'category' => $p->category?->name];
        }
        foreach ($inScope(Service::query()->with('category:id,name'))->orderBy('name')->get() as $s) {
            $rows["service:{$s->id}"] = ['key' => "service:{$s->id}", 'kind' => 'service', 'id' => $s->id, 'name' => $s->name, 'category' => $s->category?->name];
        }
        foreach ($inScope(Course::query()->with('categories:id,name'))->orderBy('name')->get() as $c) {
            $rows["course:{$c->id}"] = ['key' => "course:{$c->id}", 'kind' => 'course', 'id' => $c->id, 'name' => $c->name, 'category' => $c->categories->pluck('name')->implode(', ') ?: null];
        }
        foreach ($inScope(SubscriptionPack::query()->with('category:id,name'))->orderBy('name')->get() as $pk) {
            $rows["package:{$pk->id}"] = ['key' => "package:{$pk->id}", 'kind' => 'package', 'id' => $pk->id, 'name' => $pk->name, 'category' => $pk->category?->name];
        }

        return $rows;
    }

    /** Quantités et montants facturés des factures de la période (hors annulées / rejetées). */
    private function addSales(array &$rows, array &$other, Carbon $from, Carbon $to, ?array $agencyIds): void
    {
        $lines = DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', '!=', 'rejected')
            ->whereBetween('invoices.invoice_date', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->get(['invoice_items.invoice_id', 'invoice_items.service_id', 'invoice_items.product_id', 'invoice_items.package_id', 'invoice_items.quantity', 'invoice_items.line_total']);

        $courses = $this->enrollmentCourses($lines->pluck('invoice_id')->unique());

        foreach ($lines as $line) {
            $key = $this->lineKey($line, $courses);
            $target = &$this->bucket($rows, $other, $key);
            $target['quantity'] += (int) $line->quantity;
            $target['billed'] += (float) $line->line_total;
            unset($target);
        }
    }

    /** Encaissements de la période, répartis par ligne et par moyen de paiement. */
    private function addCollections(array &$rows, array &$other, Carbon $from, Carbon $to, ?array $agencyIds): void
    {
        $payments = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->whereBetween('invoice_payments.paid_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->get(['invoice_payments.invoice_id', 'invoice_payments.amount', 'invoice_payments.payment_method']);

        if ($payments->isEmpty()) {
            return;
        }

        $invoiceIds = $payments->pluck('invoice_id')->unique();
        $linesByInvoice = DB::table('invoice_items')
            ->whereIn('invoice_id', $invoiceIds)
            ->get(['invoice_id', 'service_id', 'product_id', 'package_id', 'line_total'])
            ->groupBy('invoice_id');
        $courses = $this->enrollmentCourses($invoiceIds);

        foreach ($payments as $payment) {
            $lines = $linesByInvoice->get($payment->invoice_id, collect());
            $linesTotal = (float) $lines->sum('line_total');
            $mode = RevenueService::normalizeMode($payment->payment_method);
            $amount = (float) $payment->amount;

            if ($linesTotal <= 0) {
                $other['collected'] += $amount;
                $other['by_mode'][$mode] += $amount;
                $other['payments']++;

                continue;
            }

            foreach ($lines as $line) {
                $share = $amount * ((float) $line->line_total / $linesTotal);
                $target = &$this->bucket($rows, $other, $this->lineKey($line, $courses));
                $target['collected'] += $share;
                $target['by_mode'][$mode] += $share;
                $target['payments']++;
                unset($target);
            }
        }
    }

    /** @return Collection<string, string> invoice_id => course_id */
    private function enrollmentCourses(Collection $invoiceIds): Collection
    {
        return $invoiceIds->isEmpty()
            ? collect()
            : DB::table('formation_enrollments')->whereIn('invoice_id', $invoiceIds)->pluck('course_id', 'invoice_id');
    }

    /** Élément du catalogue d'une ligne ; une ligne sans référence d'une facture d'inscription = la formation. */
    private function lineKey(object $line, Collection $courses): string
    {
        return match (true) {
            (bool) $line->product_id => "product:{$line->product_id}",
            (bool) $line->service_id => "service:{$line->service_id}",
            (bool) $line->package_id => "package:{$line->package_id}",
            $courses->has($line->invoice_id) => 'course:'.$courses->get($line->invoice_id),
            default => 'other',
        };
    }

    /** Ligne du rapport (élément supprimé du catalogue ou libellé libre → « Autres »). */
    private function &bucket(array &$rows, array &$other, string $key): array
    {
        if ($key !== 'other' && isset($rows[$key])) {
            return $rows[$key];
        }

        return $other;
    }
}
