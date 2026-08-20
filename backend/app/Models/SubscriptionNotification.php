<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionNotification extends Model
{
    use HasUuids;

    protected $fillable = [
        'subscription_id',
        'notification_type',
        'scheduled_for',
        'sent_at',
        'status',
        'channel',
        'attempt_count',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_for' => 'date',
            'sent_at' => 'datetime',
            'attempt_count' => 'integer',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}