<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Élément du contenu d'un package (une puce du flyer). */
class PackageItem extends Model
{
    use HasUuids;

    protected $fillable = [
        'package_id',
        'service_id',
        'label',
        'quantity',
        'frequency',
        'unit',
        'action_type',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'package_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }
}
