<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Expense extends Model
{
    use HasUuids, SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_PAID = 'paid';
    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_SUBMITTED,
        self::STATUS_APPROVED,
        self::STATUS_REJECTED,
        self::STATUS_PAID,
        self::STATUS_CLOSED,
    ];

    protected $fillable = [
        'number',
        'agency_id',
        'department_id',
        'category_id',
        'amount',
        'expense_date',
        'status',
        'requested_by',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejection_reason',
        'paid_by',
        'paid_at',
        'treasury_account_id',
        'justification_path',
        'note',
        'cancelled_by',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'expense_date' => 'date',
            'approved_at' => 'datetime',
            'paid_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AccountingCategory::class, 'category_id');
    }

    public function requestor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function treasuryAccount(): BelongsTo
    {
        return $this->belongsTo(TreasuryAccount::class, 'treasury_account_id');
    }

    public function scopeOfStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    public function scopeOfAgency(Builder $query, string $agencyId): Builder
    {
        return $query->where('agency_id', $agencyId);
    }

    public function scopeBetweenDates(Builder $query, string $from, string $to): Builder
    {
        return $query->whereBetween('expense_date', [$from, $to]);
    }

    public static function generateNextNumber(): string
    {
        $last = self::query()->orderByDesc('number')->value('number');
        $next = $last ? ((int) substr($last, 4)) + 1 : 1;

        return 'EXP-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }

    public static function statusValidationRule(): string
    {
        return 'required|string|in:'.implode(',', self::STATUSES);
    }

    /**
     * Accès direct à la contrainte métier « payé » dit si la dépense a un compte de sortie.
     */
    public function hasSettlementAccount(): bool
    {
        return $this->treasury_account_id !== null;
    }
}