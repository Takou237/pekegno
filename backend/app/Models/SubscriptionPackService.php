<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionPackService extends Model
{
    use HasUuids;

    protected $fillable = [
        'subscription_pack_id',
        'service_id',
        'price_per_month',
    ];

    protected function casts(): array
    {
        return [
            'price_per_month' => 'float',
        ];
    }

    public function pack(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'subscription_pack_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }
}
