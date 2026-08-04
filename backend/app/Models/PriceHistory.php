<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriceHistory extends Model
{
    use HasUuids;

    protected $table = 'price_history';

    protected $fillable = [
        'service_id',
        'price',
        'changed_at',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'changed_at' => 'datetime',
        ];
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }
}
