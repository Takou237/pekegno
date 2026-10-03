<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Note du client sur une action (D5 client uniquement, D11 une note par action). */
class PrestationActionReview extends Model
{
    use HasUuids;

    protected $fillable = [
        'prestation_action_id',
        'prestation_id',
        'client_user_id',
        'rating',
        'comment',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
        ];
    }

    public function action(): BelongsTo
    {
        return $this->belongsTo(PrestationAction::class, 'prestation_action_id');
    }

    public function prestation(): BelongsTo
    {
        return $this->belongsTo(Prestation::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_user_id');
    }
}
