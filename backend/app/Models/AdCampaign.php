<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdCampaign extends Model
{
    use HasUuids, SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_ACTIVE,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'name',
        'branch',
        'country_id',
        'is_national',
        'agency_id',
        'budget',
        'start_date',
        'end_date',
        'status',
        'description',
        'expense_id',
    ];

    protected $casts = [
        'is_national' => 'boolean',
        'budget' => 'float',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'ad_campaign_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeNational(Builder $query): Builder
    {
        return $query->where('is_national', true);
    }

    public function scopeLocal(Builder $query): Builder
    {
        return $query->where('is_national', false);
    }
}
