<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'description',
        'objective',
        'prerequisites',
        'cover_image',
        'mode',
        'category_id',
        'price',
        'duration_hours',
        'duration_type',
        'duration_months',
        'agency_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'duration_hours' => 'integer',
            'duration_months' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'course_categories');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(TrainingSession::class, 'course_id');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(CourseModule::class, 'course_id')->orderBy('order_index');
    }

    public function formationEnrollments(): HasMany
    {
        return $this->hasMany(FormationEnrollment::class, 'course_id');
    }

    public function promotions(): HasMany
    {
        return $this->hasMany(Promotion::class, 'formation_id');
    }

    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        if (! $search) {
            return $query;
        }

        return $query->where(function ($q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
                ->orWhere('code', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%");
        });
    }

    public function scopeAvailableIn(Builder $query, string $agencyId): Builder
    {
        return $query->where(fn ($q) => $q->where('agency_id', $agencyId)->orWhereNull('agency_id'));
    }

    public static function generateCode(): string
    {
        $last = static::withTrashed()->pluck('code')
            ->map(fn (?string $code): int => preg_match('/^CRS-(\d+)$/', (string) $code, $matches) ? (int) $matches[1] : 0)
            ->max();

        return 'CRS-'.str_pad((string) (($last ?: 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function activePromotion(): ?Promotion
    {
        if ($this->relationLoaded('promotions')) {
            return $this->promotions
                ->filter(fn (Promotion $p) => $p->isActive())
                ->sortBy('start_date')
                ->first();
        }

        return $this->promotions()
            ->where('start_date', '<=', now())
            ->where('end_date', '>=', now())
            ->orderByDesc('start_date')
            ->first();
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
