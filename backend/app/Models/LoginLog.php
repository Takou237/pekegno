<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoginLog extends Model
{
    use HasUuids;

    const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'action',
        'ip_address',
        'user_agent',
        'session_id',
        'failure_reason',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
