<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubscriptionPack extends Model
{
    use HasUuids;

    protected $fillable = [
        'agency_id',
        'name',
        'description',
        'price_per_month',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price_per_month' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function packServices(): HasMany
    {
        return $this->hasMany(SubscriptionPackService::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
