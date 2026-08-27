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
        'formation_id',
        'type',
        'promo_price',
        'discount_percent',
        'start_date',
        'end_date',
    ];

    protected function casts(): array
    {
        return [
            'promo_price' => 'decimal:2',
            'discount_percent' => 'decimal:2',
            'start_date' => 'datetime',
            'end_date' => 'datetime',
        ];
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function formation(): BelongsTo
    {
        return $this->belongsTo(Course::class, 'formation_id');
    }

    public function isActive(): bool
    {
        return $this->start_date <= now() && $this->end_date >= now();
    }

    /**
     * Prix effectif de la promotion (rebasé sur le prix du service/formation pour le type percent).
     */
    public function effectivePrice(?float $basePrice = null): ?float
    {
        if ($this->type === 'percent' && $this->discount_percent !== null && $basePrice !== null) {
            return round($basePrice * (1 - (float) $this->discount_percent / 100), 2);
        }

        return $this->promo_price !== null ? (float) $this->promo_price : null;
    }
}
