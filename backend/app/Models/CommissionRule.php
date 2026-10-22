<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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

    /** Assiette : ce qui déclenche la commission. */
    public const BASIS_SALE = 'sale';
    public const BASIS_RENEWAL = 'renewal';
    public const BASIS_UPGRADE = 'upgrade';
    public const BASIS_MONTHLY_REVENUE = 'monthly_revenue';
    public const BASIS_GROWTH = 'growth';
    public const BASIS_MANUAL = 'manual';

    public const BASES = [
        self::BASIS_SALE,
        self::BASIS_RENEWAL,
        self::BASIS_UPGRADE,
        self::BASIS_MONTHLY_REVENUE,
        self::BASIS_GROWTH,
        self::BASIS_MANUAL,
    ];

    /** Assiettes calculées à chaque encaissement (les autres le sont par mois ou à la main). */
    public const PAYMENT_BASES = [self::BASIS_SALE, self::BASIS_RENEWAL, self::BASIS_UPGRADE];

    /** Assiettes calculées à la clôture d'un mois. */
    public const PERIOD_BASES = [self::BASIS_MONTHLY_REVENUE, self::BASIS_GROWTH];

    public const REVENUE_SCOPES = ['own', 'agency'];

    /** Genres ciblables : toute ligne de ce genre (un élément précis reste optionnel). */
    public const TARGET_KINDS = ['product', 'service', 'course', 'package'];

    public const RECOVERY_PERIODS = ['previous_month', 'same_month_last_year'];

    protected $fillable = [
        'rule_group_id',
        'version',
        'name',
        'basis',
        'target_kind',
        'description',
        'beneficiary_commercial_id',
        'beneficiary_seller_profile_id',
        'scope_country_id',
        'scope_agency_id',
        'scope_department_id',
        'service_id',
        'course_id',
        'package_id',
        'product_id',
        'category_id',
        'renewal_number',
        'renewal_on_time',
        'revenue_scope',
        'min_recovery_rate',
        'recovery_period',
        'growth_multiplier',
        'max_percent',
        'bonus_min',
        'bonus_max',
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
            'renewal_number' => 'integer',
            'renewal_on_time' => 'boolean',
            'min_recovery_rate' => 'decimal:2',
            'growth_multiplier' => 'decimal:2',
            'max_percent' => 'decimal:2',
            'bonus_min' => 'decimal:2',
            'bonus_max' => 'decimal:2',
        ];
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Commercial::class, 'beneficiary_commercial_id');
    }

    public function sellerProfile(): BelongsTo
    {
        return $this->belongsTo(SellerProfile::class, 'beneficiary_seller_profile_id');
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'package_id');
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

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Rôles bénéficiaires. Rattachés au groupe de la règle (rule_group_id) pour
     * que l'attribution survive aux nouvelles versions.
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'commission_rule_role', 'rule_group_id', 'role_id', 'rule_group_id')
            ->withTimestamps();
    }

    public function isPeriodic(): bool
    {
        return in_array($this->basis, self::PERIOD_BASES, true);
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

    /**
     * Paliers « à partir de » (CA mensuel, croissance) :
     * [{min, percent, fixed_bonus, pot_bonus, bonus_requires_recovery}].
     * Le palier retenu est le plus haut dont le seuil est atteint par $reference
     * (le CA, ou le ratio de croissance) ; le pourcentage s'applique à $baseAmount.
     * Les bonus (prime fixe, cagnotte) peuvent exiger la condition de recouvrement.
     *
     * @return array{amount: float, tier: array|null}
     */
    public function computeThresholdTiers(float $baseAmount, float $reference, bool $recoveryOk): array
    {
        $tiers = is_array($this->tiers_json) ? $this->tiers_json : [];
        usort($tiers, fn ($a, $b) => ((float) ($a['min'] ?? 0)) <=> ((float) ($b['min'] ?? 0)));

        $selected = null;
        foreach ($tiers as $tier) {
            if ($reference >= (float) ($tier['min'] ?? 0)) {
                $selected = $tier;
            }
        }

        if ($selected === null) {
            return ['amount' => 0.0, 'tier' => null];
        }

        $percent = (float) ($selected['percent'] ?? 0);
        if ($this->max_percent !== null) {
            $percent = min($percent, (float) $this->max_percent);
        }

        $amount = ($percent / 100) * $baseAmount;

        $bonusAllowed = empty($selected['bonus_requires_recovery']) || $recoveryOk;
        if ($bonusAllowed) {
            $amount += (float) ($selected['fixed_bonus'] ?? 0) + (float) ($selected['pot_bonus'] ?? 0);
        }

        return ['amount' => round($amount, 2), 'tier' => $selected + ['bonus_applied' => $bonusAllowed]];
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
            'beneficiary_seller_profile_id' => $this->beneficiary_seller_profile_id,
            'scope_country_id' => $this->scope_country_id,
            'scope_agency_id' => $this->scope_agency_id,
            'scope_department_id' => $this->scope_department_id,
            'service_id' => $this->service_id,
            'course_id' => $this->course_id,
            'package_id' => $this->package_id,
            'basis' => $this->basis,
            'target_kind' => $this->target_kind,
            'product_id' => $this->product_id,
            'category_id' => $this->category_id,
            'renewal_number' => $this->renewal_number,
            'renewal_on_time' => $this->renewal_on_time,
            'revenue_scope' => $this->revenue_scope,
            'min_recovery_rate' => $this->min_recovery_rate,
            'growth_multiplier' => $this->growth_multiplier,
            'max_percent' => $this->max_percent,
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