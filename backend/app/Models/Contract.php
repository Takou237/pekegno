<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contract extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_DUE_SOON = 'due_soon';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_TERMINATED = 'terminated';
    public const STATUS_RENEWED = 'renewed';

    public const ORIGIN_MANUAL = 'manual';
    public const ORIGIN_PRESTATION = 'prestation';
    public const ORIGIN_PACKAGE = 'package';

    public const ORIGINS = [self::ORIGIN_MANUAL, self::ORIGIN_PRESTATION, self::ORIGIN_PACKAGE];

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_PENDING,
        self::STATUS_ACTIVE,
        self::STATUS_DUE_SOON,
        self::STATUS_EXPIRED,
        self::STATUS_SUSPENDED,
        self::STATUS_TERMINATED,
        self::STATUS_RENEWED,
    ];

    public const BILLING_CYCLES = [
        'one_shot',
        'monthly',
        'quarterly',
        'yearly',
    ];

    protected $fillable = [
        'number',
        'client_id',
        'company_id',
        'agency_id',
        'department_id',
        'pack_id',
        'origin',
        'prestation_id',
        'commercial_id',
        'budget_allocated',
        'activated_at',
        'signed_at',
        'signed_document_path',
        'suspended_reason',
        'legacy_subscription_id',
        'start_date',
        'end_date',
        'billing_cycle',
        'amount',
        'status',
        'auto_renew',
        'renewal_count',
        'parent_contract_id',
        'notes',
        'terminated_at',
        'terminated_reason',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'auto_renew' => 'boolean',
            'renewal_count' => 'integer',
            'amount' => 'decimal:2',
            'budget_allocated' => 'decimal:2',
            'activated_at' => 'datetime',
            'signed_at' => 'datetime',
            'terminated_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function pack(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'pack_id');
    }

    public function prestation(): BelongsTo
    {
        return $this->belongsTo(Prestation::class);
    }

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(Commercial::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function parentContract(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_contract_id');
    }

    public function childContracts(): HasMany
    {
        return $this->hasMany(self::class, 'parent_contract_id');
    }

    public function services(): HasMany
    {
        return $this->hasMany(ContractService::class);
    }

    public static function generateNextNumber(): string
    {
        $last = static::withTrashed()->orderByDesc('number')->value('number');
        $next = $last ? ((int) substr($last, 4)) + 1 : 1;

        return 'CTR-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }

    public function scopeOfStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    public function scopeOfClient(Builder $query, string $clientId): Builder
    {
        return $query->where('client_id', $clientId);
    }

    public function scopeOfAgency(Builder $query, string $agencyId): Builder
    {
        return $query->where('agency_id', $agencyId);
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_ACTIVE, self::STATUS_DUE_SOON]);
    }
}
