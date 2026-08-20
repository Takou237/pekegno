<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends Model
{
    use HasUuids;

    public const LIFECYCLE_STATUSES = ['draft', 'pending', 'active', 'suspended', 'expired', 'cancelled', 'renewed'];

    protected $appends = ['days_to_expiry'];

    protected $fillable = [
        'subscription_pack_id',
        'agency_id',
        'client_id',
        'months',
        'price_per_month',
        'total_price',
        'start_date',
        'end_date',
        'invoice_id',
        'status',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'months' => 'integer',
            'price_per_month' => 'float',
            'total_price' => 'float',
            'start_date' => 'date',
            'end_date' => 'date',
            'cancelled_at' => 'date',
        ];
    }

    public function pack(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'subscription_pack_id');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(SubscriptionNotification::class);
    }

    /**
     * Jours restants avant expiration (négatif = déjà expiré).
     */
    public function getDaysToExpiryAttribute(): ?int
    {
        return $this->end_date
            ? (int) today()->diffInDays($this->end_date, false)
            : null;
    }

    /**
     * Fait basculer un abonnement actif/pending/suspended en « expired »
     * dès que sa date de fin est passée.
     */
    public function refreshStatusIfExpired(): self
    {
        if (in_array($this->status, ['active', 'pending', 'suspended'], true) && $this->end_date->lt(today())) {
            $this->update(['status' => 'expired']);
            $this->refresh();
        }

        return $this;
    }

    public function isReminderEligible(): bool
    {
        return ! in_array($this->status, ['cancelled', 'renewed', 'expired'], true);
    }
}