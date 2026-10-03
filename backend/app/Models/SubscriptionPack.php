<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Pack d'abonnement — dans le département Agency, c'est un « package » :
 * offre type catégorisée (Starter, Booster…) avec items, recommandations,
 * prérequis, prix barré et promotions.
 */
class SubscriptionPack extends Model
{
    use HasUuids;

    public const BILLING_PERIODS = ['monthly', 'quarterly', 'yearly', 'one_shot'];

    /** Nombre de mois couverts par une période de facturation. */
    public const PERIOD_MONTHS = [
        'monthly' => 1,
        'quarterly' => 3,
        'yearly' => 12,
        'one_shot' => 1,
    ];

    protected $fillable = [
        'code',
        'agency_id',
        'department_id',
        'category_id',
        'name',
        'tagline',
        'description',
        'prerequisites',
        'price_per_month',
        'original_price',
        'price_is_starting_from',
        'billing_period',
        'min_duration_months',
        'sort_order',
        'is_active',
        'is_public',
        'cover_image',
    ];

    protected $appends = ['effective_price'];

    protected function casts(): array
    {
        return [
            'price_per_month' => 'decimal:2',
            'original_price' => 'decimal:2',
            'price_is_starting_from' => 'boolean',
            'min_duration_months' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'is_public' => 'boolean',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AgencyCategory::class, 'category_id');
    }

    public function packServices(): HasMany
    {
        return $this->hasMany(SubscriptionPackService::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PackageItem::class, 'package_id')->orderBy('sort_order');
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(PackageRecommendation::class, 'package_id')->orderBy('sort_order');
    }

    public function promotions(): HasMany
    {
        return $this->hasMany(Promotion::class, 'package_id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'pack_id');
    }

    public function prestations(): HasMany
    {
        return $this->hasMany(Prestation::class, 'package_id');
    }

    public function activePromotion(): ?Promotion
    {
        $promotions = $this->relationLoaded('promotions') ? $this->promotions : $this->promotions()->get();

        return $promotions
            ->filter(fn (Promotion $promotion) => $promotion->isActive())
            ->sortBy(fn (Promotion $promotion) => $promotion->effectivePrice((float) $this->price_per_month) ?? PHP_FLOAT_MAX)
            ->first();
    }

    /** Prix par période après la promotion active éventuelle. */
    public function getEffectivePriceAttribute(): float
    {
        $base = (float) $this->price_per_month;
        $promoPrice = $this->activePromotion()?->effectivePrice($base);

        return $promoPrice !== null ? min($base, $promoPrice) : $base;
    }

    public static function generateCode(): string
    {
        $max = static::query()
            ->whereNotNull('code')
            ->pluck('code')
            ->map(fn (?string $code): int => preg_match('/^PKG-(\d+)$/', (string) $code, $m) ? (int) $m[1] : 0)
            ->max() ?? 0;

        return 'PKG-'.str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }
}
