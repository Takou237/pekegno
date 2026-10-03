<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrestationActionComment extends Model
{
    use HasUuids;

    protected $fillable = [
        'prestation_action_id',
        'user_id',
        'body',
        'attachment_path',
    ];

    public function action(): BelongsTo
    {
        return $this->belongsTo(PrestationAction::class, 'prestation_action_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
