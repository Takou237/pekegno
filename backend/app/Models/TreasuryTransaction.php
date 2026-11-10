<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TreasuryTransaction extends Model
{
    use HasUuids, SoftDeletes;

    public const DIRECTION_IN = 'in';
    public const DIRECTION_OUT = 'out';

    public const DIRECTIONS = [
        self::DIRECTION_IN,
        self::DIRECTION_OUT,
    ];

    /** T2.6 — nature d'un transfert (jamais une dépense). */
    public const TRANSFER_TYPES = [
        'bank_deposit',       // versement d'espèces en banque
        'admin_disbursement', // décaissement administratif
        'withdrawal',         // retrait
        'internal',           // transfert interne entre caisses
    ];

    protected $fillable = [
        'treasury_account_id',
        'direction',
        'amount',
        'source_type',
        'source_id',
        'category',
        'transfer_type',
        'label',
        'reference',
        'transacted_at',
        'created_by',
    ];

    /**
     * Clôture de caisse : une caisse clôturée ne reçoit ni n'émet plus rien
     * jusqu'à sa réouverture, et une journée clôturée ne bouge plus (un
     * mouvement daté d'avant la clôture est porté sur la journée en cours).
     * Les commandes de rattrapage de l'historique désactivent ce contrôle.
     */
    public static bool $enforceCashClosing = true;

    protected static function booted(): void
    {
        static::creating(function (TreasuryTransaction $transaction) {
            if (! self::$enforceCashClosing || ! $transaction->treasury_account_id) {
                return;
            }

            $open = CashClosing::openFor($transaction->treasury_account_id);
            if ($open) {
                $account = TreasuryAccount::find($transaction->treasury_account_id);
                abort(422, sprintf(
                    'La caisse « %s » est clôturée depuis le %s : rien n\'y entre ni n\'en sort avant sa réouverture.',
                    trim(($account?->code ? $account->code.' · ' : '').($account?->name ?? '')),
                    $open->closed_at?->timezone(config('app.business_timezone', 'Africa/Douala'))->format('d/m/Y à H:i') ?? '?',
                ));
            }

            $lastClosedAt = CashClosing::lastClosedAt($transaction->treasury_account_id);
            if ($lastClosedAt && (! $transaction->transacted_at || $transaction->transacted_at->lte($lastClosedAt))) {
                $transaction->transacted_at = now()->max($lastClosedAt->copy()->addSecond());
            }
        });
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'transacted_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(TreasuryAccount::class, 'treasury_account_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function source()
    {
        return $this->morphTo();
    }

    public function scopeOfAccount($query, string $accountId)
    {
        return $query->where('treasury_account_id', $accountId);
    }

    public function scopeDirection($query, string $direction)
    {
        return $query->where('direction', $direction);
    }

    public function scopeBetweenDates($query, string $from, string $to)
    {
        return $query->whereBetween('transacted_at', [$from, $to]);
    }

    public static function directionValidationRule(): string
    {
        return 'required|string|in:' . implode(',', self::DIRECTIONS);
    }
}
