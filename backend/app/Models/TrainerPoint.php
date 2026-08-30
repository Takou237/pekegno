<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Trace les points PEKEGNO attribués à un formateur (ventes payées).
 * Le solde affiché est recalculé depuis la somme (trainers.points_balance).
 */
class TrainerPoint extends Model
{
    use HasUuids;

    const UPDATED_AT = null;

    protected $fillable = [
        'trainer_id',
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

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(Trainer::class);
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