<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommercialPoint extends Model
{
    use HasUuids;

    const UPDATED_AT = null;

    protected $fillable = [
        'commercial_id',
        'points',
        'reason',
        'invoice_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
        ];
    }

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(Commercial::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
