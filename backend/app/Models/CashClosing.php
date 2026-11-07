<?php

namespace App\Models;

use App\Services\ScopeService;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashClosing extends Model
{
    use HasUuids;

    public const STATUS_CLOSED = 'closed';

    public const STATUS_VALIDATED = 'validated';

    protected $fillable = [
        'agency_id',
        'treasury_account_id',
        'closing_date',
        'opening_balance',
        'theoretical_balance',
        'actual_balance',
        'difference',
        'justification',
        'status',
        'closed_by',
        'validated_by',
        'validated_at',
    ];

    protected function casts(): array
    {
        return [
            'closing_date' => 'date',
            'opening_balance' => 'decimal:2',
            'theoretical_balance' => 'decimal:2',
            'actual_balance' => 'decimal:2',
            'difference' => 'decimal:2',
            'validated_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(TreasuryAccount::class, 'treasury_account_id');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function hasDifference(): bool
    {
        return abs((float) $this->difference) > 0.009;
    }

    public function scopeVisibleTo($query, ?User $user)
    {
        if (! $user) {
            return $query->whereRaw('1 = 0');
        }

        if (app(ScopeService::class)->isGlobal($user)) {
            return $query;
        }

        return $query->whereHas('account', fn ($q) => $q->visibleTo($user));
    }
}
