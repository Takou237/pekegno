<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
        return $this->promotions
            ->filter(fn (Promotion $promotion) => $promotion->isActive())
            ->sortBy('start_date')
            ->first();
    }

    public function getEffectivePriceAttribute(): string
    {
        $active = $this->activePromotion();

        return $active ? (string) $active->promo_price : (string) $this->price;
    }
}
