<?php

namespace App\Models;

use App\Services\ReceiptNumberGenerator;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoicePayment extends Model
{
    use HasUuids;

    protected $fillable = [
        'invoice_id',
        'amount',
        'payment_method',
        'is_advance',
        'paid_at',
        'received_by',
        'comment',
        'treasury_account_id',
        'receipt_number',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'is_advance' => 'boolean',
            'paid_at' => 'datetime',
        ];
    }

    /**
     * Chaque versement reçoit un numéro de reçu à sa création : c'est ce reçu
     * qui s'imprime tant que la facture n'est pas soldée.
     */
    protected static function booted(): void
    {
        static::creating(function (InvoicePayment $payment) {
            $payment->receipt_number ??= app(ReceiptNumberGenerator::class)->next();
        });
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function treasuryAccount(): BelongsTo
    {
        return $this->belongsTo(TreasuryAccount::class);
    }
}
