<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Service extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'agency_id',
        'category_id',
        'name',
        'description',
        'price',
        'cover_image',
        'presentation_video',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
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

    public function promotions(): HasMany
    {
        return $this->hasMany(Promotion::class)->orderBy('start_date');
    }

    public function oneActivePromotion(): HasOne
    {
        return $this->hasOne(Promotion::class)
            ->where('start_date', '<=', now())
            ->where('end_date', '>=', now())
            ->orderByDesc('start_date');
    }

    public function priceHistory(): HasMany
    {
        return $this->hasMany(PriceHistory::class)->orderByDesc('changed_at');
    }

    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        if (! $search) {
            return $query;
        }

        return $query->where(function ($q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%");
        });
    }

    public function activePromotion(): ?Promotion
    {
        // Si la collection des promotions est déjà chargée (catalogue), on filtre en mémoire.
        if ($this->relationLoaded('promotions')) {
            return $this->promotions
                ->filter(fn (Promotion $promotion) => $promotion->isActive())
                ->sortBy('start_date')
                ->first();
        }

        // Sinon requête ciblée unique via la relation (évite le chargement de toute la collection).
        return $this->oneActivePromotion()->first();
    }

    public function getEffectivePriceAttribute(): string
    {
        $active = $this->activePromotion();

        if (! $active) {
            return (string) $this->price;
        }

        if ($active->type === 'percent' && $active->discount_percent !== null) {
            $discounted = (float) $this->price * (1 - (float) $active->discount_percent / 100);

            return (string) round($discounted, 2);
        }

        return (string) ($active->promo_price ?? $this->price);
    }
}
