<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'number',
        'agency_id',
        'client_id',
        'commercial_id',
        'invoice_id',
        'status',
        'order_date',
        'subtotal',
        'discount',
        'vat_rate',
        'total_amount',
        'notes',
        'proof_path',
        'proof_url',
        'submitted_at',
        'validated_by',
        'validation_note',
        'validated_at',
    ];

    protected function casts(): array
    {
        return [
            'order_date' => 'date',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'vat_rate' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'submitted_at' => 'datetime',
            'validated_at' => 'datetime',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(Commercial::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(OrderLine::class);
    }

    public function validatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }
}