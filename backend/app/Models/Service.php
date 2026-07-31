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
        'department_id',
        'category_id',
        'name',
        'description',
        'price',
        'coverage',
        'presentation_video',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function promotions(): HasMany
    {
        return $this->hasMany(Promotion::class);
    }

    public function priceHistory(): HasMany
    {
        return $this->hasMany(PriceHistory::class);
    }

    /**
     * Promotion actuellement active (dates valides + is_active = true).
     */
    public function activePromotion(): HasMany
    {
        return $this->hasMany(Promotion::class)
            ->where('is_active', true)
            ->where('start_date', '<=', now())
            ->where('end_date', '>=', now());
    }

    /**
     * Prix effectif du service : prix promotionnel actif sinon prix de base.
     */
    public function getCurrentPriceAttribute(): ?string
    {
        $active = $this->relationLoaded('activePromotion')
            ? $this->activePromotion->first()
            : null;

        return $active ? $active->promotional_price : $this->price;
    }

    public function getHasActivePromotionAttribute(): bool
    {
        $active = $this->relationLoaded('activePromotion')
            ? $this->activePromotion->first()
            : null;

        return $active !== null;
    }

    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        if (! $search) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%");
        });
    }

    public function scopeOfCategory(Builder $query, ?string $categoryId): Builder
    {
        return $categoryId ? $query->where('category_id', $categoryId) : $query;
    }

    public function scopeOfAgency(Builder $query, ?string $agencyId): Builder
    {
        return $agencyId ? $query->where('agency_id', $agencyId) : $query;
    }

    public function scopeOfDepartment(Builder $query, ?string $departmentId): Builder
    {
        return $departmentId ? $query->where('department_id', $departmentId) : $query;
    }
}
