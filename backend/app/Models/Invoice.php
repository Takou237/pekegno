<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use HasUuids;

    protected $fillable = [
        'number',
        'agency_id',
        'client_id',
        'commercial_id',
        'seller_user_id',
        'invoice_date',
        'payment_type',
        'total_amount',
        'amount_paid',
        'status',
        'commission_amount',
        'points_awarded',
        'comment',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'datetime',
            'cancelled_at' => 'datetime',
            'total_amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'commission_amount' => 'decimal:2',
            'points_awarded' => 'integer',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(Commercial::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class);
    }

    public function points(): HasMany
    {
        return $this->hasMany(CommercialPoint::class);
    }

    public function getBalanceDueAttribute(): float
    {
        return round(max(0, (float) $this->total_amount - (float) $this->amount_paid), 2);
    }

    public function getIsCancelledAttribute(): bool
    {
        return $this->cancelled_at !== null;
    }

    /**
     * Snapshot des informations d'agence pour l'impression (choix plan §4.8 : jointure + accesseur).
     */
    public function getAgencySnapshotAttribute(): ?array
    {
        $agency = $this->agency;

        if (! $agency) {
            return null;
        }

        return [
            'name' => $agency->name,
            'code' => $agency->code,
            'city' => $agency->city,
            'address' => $agency->address,
            'phone' => $agency->phone,
            'email' => $agency->email,
        ];
    }

    /**
     * Déduit le statut de amount_paid vs total_amount (règle métier du plan §2.4).
     */
    public function refreshStatus(): void
    {
        $this->status = match (true) {
            (float) $this->amount_paid >= (float) $this->total_amount => 'paid',
            (float) $this->amount_paid > 0 => 'partial',
            default => 'unpaid',
        };
    }
}
