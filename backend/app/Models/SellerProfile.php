<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SellerProfile extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'user_id',
        'agency_id',
        'kind',
        'commission_type',
        'commission_value',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'commission_value' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public const KIND_TRAINER = 'trainer';
    public const KIND_COMMERCIAL = 'commercial';
    public const KIND_EMPLOYEE = 'employee';

    public const KINDS = [
        self::KIND_TRAINER,
        self::KIND_COMMERCIAL,
        self::KIND_EMPLOYEE,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function commissionEntries(): HasMany
    {
        return $this->hasMany(CommissionEntry::class, 'seller_profile_id');
    }

    public function commissionPayments(): HasMany
    {
        return $this->hasMany(CommissionPayment::class, 'seller_profile_id');
    }

    public function getFullNameAttribute(): string
    {
        return trim(($this->user?->first_name ?? '').' '.($this->user?->last_name ?? ''))
            ?? ($this->user?->email ?? '');
    }

    /**
     * Calcule le montant de commission pour un montant donné.
     */
    public function computeCommission(float $amount): float
    {
        return match ($this->commission_type) {
            'percent' => round(($this->commission_value / 100) * $amount, 2),
            'fixed' => (float) $this->commission_value,
            default => 0.0,
        };
    }

    /**
     * Solde total des commissions (entries calculées/validées - paiements).
     */
    public function balance(): float
    {
        $total = $this->commissionEntries()
            ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED])
            ->sum('amount');

        $paid = $this->commissionPayments()->sum('amount');

        return round((float) $total - (float) $paid, 2);
    }

    /**
     * Total commissions par catégorie (training/service).
     */
    public function totalByCategory(string $category): float
    {
        return (float) $this->commissionEntries()
            ->where('category', $category)
            ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED])
            ->sum('amount');
    }
}
