<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class CommissionRule extends Model
{
    use HasUuids, SoftDeletes;

    public const TRIGGER_ON_SALE = 'on_sale';
    public const TRIGGER_ON_PAYMENT = 'on_payment';
    public const TRIGGER_ON_FULL_PAYMENT = 'on_full_payment';

    public const TRIGGERS = [
        self::TRIGGER_ON_SALE,
        self::TRIGGER_ON_PAYMENT,
        self::TRIGGER_ON_FULL_PAYMENT,
    ];

    public const FORMULA_PERCENT = 'percent';
    public const FORMULA_FIXED = 'fixed';
    public const FORMULA_TIERED = 'tiered';

    public const FORMULAS = [
        self::FORMULA_PERCENT,
        self::FORMULA_FIXED,
        self::FORMULA_TIERED,
    ];

    protected $fillable = [
        'rule_group_id',
        'version',
        'name',
        'beneficiary_commercial_id',
        'scope_country_id',
        'scope_agency_id',
        'scope_department_id',
        'service_id',
        'trigger_event',
        'formula_type',
        'percent_value',
        'fixed_amount',
        'tiers_json',
        'starts_on',
        'ends_on',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'percent_value' => 'decimal:2',
            'fixed_amount' => 'decimal:2',
            'tiers_json' => 'array',
            'starts_on' => 'date',
            'ends_on' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Commercial::class, 'beneficiary_commercial_id');
    }

    public function scopeCountry(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'scope_country_id');
    }

    public function scopeAgency(): BelongsTo
    {
        return $this->belongsTo(Agency::class, 'scope_agency_id');
    }

    public function scopeDepartment(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'scope_department_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function entries()
    {
        return $this->hasMany(CommissionEntry::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Montant de la commission selon la formule, pour une base donnée.
     */
    public function computeAmount(float $baseAmount): float
    {
        return match ($this->formula_type) {
            self::FORMULA_PERCENT => round(((float) $this->percent_value / 100) * $baseAmount, 2),
            self::FORMULA_FIXED => (float) $this->fixed_amount,
            self::FORMULA_TIERED => $this->computeTiered($baseAmount),
            default => 0.0,
        };
    }

    private function computeTiered(float $baseAmount): float
    {
        $tiers = is_array($this->tiers_json) ? $this->tiers_json : [];

        usort($tiers, fn ($a, $b) => ((float) ($a['up_to'] ?? 0)) <=> ((float) ($b['up_to'] ?? 0)));

        $selected = null;
        foreach ($tiers as $tier) {
            if ($baseAmount <= (float) ($tier['up_to'] ?? PHP_FLOAT_MAX)) {
                $selected = $tier;
                break;
            }
        }

        if ($selected === null) {
            $selected = $tiers[count($tiers) - 1] ?? [];
        }

        $value = (float) ($selected['value'] ?? 0);
        $mode = $selected['mode'] ?? 'percent';

        return $mode === 'fixed' ? $value : round(($value / 100) * $baseAmount, 2);
    }

    /**
     * Snapshot JSON complet de la règle (pour l'immuabilité des entrées passées).
     */
    public function snapshot(): array
    {
        return [
            'id' => $this->id,
            'rule_group_id' => $this->rule_group_id,
            'version' => $this->version,
            'name' => $this->name,
            'beneficiary_commercial_id' => $this->beneficiary_commercial_id,
            'scope_country_id' => $this->scope_country_id,
            'scope_agency_id' => $this->scope_agency_id,
            'scope_department_id' => $this->scope_department_id,
            'service_id' => $this->service_id,
            'trigger_event' => $this->trigger_event,
            'formula_type' => $this->formula_type,
            'percent_value' => $this->percent_value,
            'fixed_amount' => $this->fixed_amount,
            'tiers_json' => $this->tiers_json,
            'starts_on' => $this->starts_on?->toDateString(),
            'ends_on' => $this->ends_on?->toDateString(),
        ];
    }
}