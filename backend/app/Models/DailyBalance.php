<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyBalance extends Model
{
    use HasUuids;

    protected $fillable = [
        'agency_id',
        'date',
        'solde_initial',
        'solde_final',
    ];

    protected function casts(): array
    {
        return [
            'solde_initial' => 'float',
            'solde_final' => 'float',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }
}
