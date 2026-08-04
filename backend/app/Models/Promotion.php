<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Promotion extends Model
{
    use HasUuids;

    protected $fillable = [
        'service_id',
        'promo_price',
        'start_date',
        'end_date',
    ];

    protected function casts(): array
    {
        return [
            'promo_price' => 'decimal:2',
            'start_date' => 'datetime',
            'end_date' => 'datetime',
        ];
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function isActive(): bool
    {
        return $this->start_date <= now() && $this->end_date >= now();
    }
}
