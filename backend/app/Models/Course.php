<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'description',
        'mode',
        'category_id',
        'price',
        'duration_hours',
        'agency_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'duration_hours' => 'integer',
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

    public function sessions(): HasMany
    {
        return $this->hasMany(TrainingSession::class, 'course_id');
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

    /**
     * Disponibilité : filtre par agence en incluant les cours globaux.
     */
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
}