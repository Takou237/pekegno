<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'sku',
        'name',
        'description',
        'category_id',
        'brand',
        'purchase_price',
        'selling_price',
        'tax_rate',
        'is_stock_managed',
        'is_active',
        'agency_id',
    ];

    protected function casts(): array
    {
        return [
            'purchase_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'is_stock_managed' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /**
     * Prix de vente TTC si une TVA est configurée.
     */
    public function getPriceWithTaxAttribute(): float
    {
        return round((float) $this->selling_price * (1 + (float) $this->tax_rate / 100), 2);
    }

    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        if (! $search) {
            return $query;
        }

        return $query->where(function ($q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
                ->orWhere('sku', 'like', "%{$search}%")
                ->orWhere('brand', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%");
        });
    }

    /**
     * Disponibilité : filtre par agence en incluant les produits globaux.
     */
    public function scopeAvailableIn(Builder $query, string $agencyId): Builder
    {
        return $query->where(fn ($q) => $q->where('agency_id', $agencyId)->orWhereNull('agency_id'));
    }

    public static function generateSku(): string
    {
        $last = static::withTrashed()->pluck('sku')
            ->map(fn (string $sku): int => preg_match('/^PRD-(\d+)$/', $sku, $matches) ? (int) $matches[1] : 0)
            ->max();

        return 'PRD-'.str_pad((string) (($last ?: 0) + 1), 5, '0', STR_PAD_LEFT);
    }
}