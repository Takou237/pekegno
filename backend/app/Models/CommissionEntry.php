<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommissionEntry extends Model
{
    use HasUuids;

    public const STATUS_CALCULATED = 'calculated';
    public const STATUS_VALIDATED = 'validated';
    public const STATUS_PAID = 'paid';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_CALCULATED,
        self::STATUS_VALIDATED,
        self::STATUS_PAID,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'invoice_id',
        'invoice_payment_id',
        'commission_rule_id',
        'rule_snapshot',
        'beneficiary_commercial_id',
        'seller_profile_id',
        'base_amount',
        'amount',
        'category',
        'product_id',
        'product_type',
        'status',
        'validated_by',
        'validated_at',
        'paid_by',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'rule_snapshot' => 'array',
            'base_amount' => 'decimal:2',
            'amount' => 'decimal:2',
            'validated_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(InvoicePayment::class, 'invoice_payment_id');
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(CommissionRule::class, 'commission_rule_id');
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Commercial::class, 'beneficiary_commercial_id');
    }

    public function sellerProfile(): BelongsTo
    {
        return $this->belongsTo(SellerProfile::class);
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function scopeOfStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    public function scopeBetweenDates(Builder $query, string $from, string $to): Builder
    {
        return $query->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59']);
    }

    /**
     * Exécute une transition de statut atomiquement si elle est autorisée.
     *
     * @return bool true si la transition a été appliquée
     */
    public function transitionTo(string $newStatus, string $actorUserId, ?string $metadata = null): bool
    {
        $allowed = match ($this->status) {
            self::STATUS_CALCULATED => in_array($newStatus, [self::STATUS_VALIDATED, self::STATUS_CANCELLED], true),
            self::STATUS_VALIDATED => $newStatus === self::STATUS_PAID,
            default => false,
        };

        if (! $allowed) {
            return false;
        }

        $this->status = $newStatus;

        if ($newStatus === self::STATUS_VALIDATED) {
            $this->validated_by = $actorUserId;
            $this->validated_at = now();
        }

        if ($newStatus === self::STATUS_PAID) {
            $this->paid_by = $actorUserId;
            $this->paid_at = now();
        }

        $this->save();

        return true;
    }
}