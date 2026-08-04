<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Formation extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'type',
        'duration',
        'conditions',
        'deposit_amount',
        'installments_count',
        'online_payment',
    ];

    protected function casts(): array
    {
        return [
            'deposit_amount' => 'decimal:2',
            'installments_count' => 'integer',
            'online_payment' => 'boolean',
        ];
    }

    // La clé primaire de la formation est partagée avec celle du service
    // (spécialisation 1-1 : formations.id = services.id).
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'id', 'id');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(Module::class)->orderBy('order');
    }
}
