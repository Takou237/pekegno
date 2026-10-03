<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Journal d'exécution d'une action (une réalisation = une ligne). */
class PrestationActionLog extends Model
{
    use HasUuids;

    protected $fillable = [
        'prestation_action_id',
        'user_id',
        'done_at',
        'quantity_done',
        'proof_url',
        'cost',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'done_at' => 'datetime',
            'quantity_done' => 'integer',
            'cost' => 'decimal:2',
        ];
    }

    public function action(): BelongsTo
    {
        return $this->belongsTo(PrestationAction::class, 'prestation_action_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
