<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    use HasUuids;

    protected $fillable = [
        'subscription_pack_id',
        'agency_id',
        'client_id',
        'months',
        'price_per_month',
        'total_price',
        'start_date',
        'end_date',
        'invoice_id',
    ];

    protected function casts(): array
    {
        return [
            'months' => 'integer',
            'price_per_month' => 'float',
            'total_price' => 'float',
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function pack(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'subscription_pack_id');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
