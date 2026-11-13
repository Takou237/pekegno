<?php

namespace App\Models;

use App\Services\ScopeService;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TreasuryAccount extends Model
{
    use HasUuids, SoftDeletes;

    public const TYPE_CASH = 'cash';
    public const TYPE_MOBILE_MONEY = 'mobile_money';
    public const TYPE_BANK = 'bank';

    public const TYPES = [
        self::TYPE_CASH,
        self::TYPE_MOBILE_MONEY,
        self::TYPE_BANK,
    ];

    protected $fillable = [
        'agency_id',
        'country_id',
        'name',
        'code',
        'method_key',
        'type',
        'provider',
        'account_number',
        'opening_balance',
        'currency_code',
        'is_active',
        'visible_roles',
    ];

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'is_active' => 'boolean',
            'visible_roles' => 'array',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(TreasuryTransaction::class, 'treasury_account_id');
    }

    /**
     * Calculé : opening_balance + SUM(in) - SUM(out).
     * Le solde n'est jamais stocké.
     */
    public function getComputedBalanceAttribute(): float
    {
        $in = $this->transactions()->where('direction', 'in')->sum('amount');
        $out = $this->transactions()->where('direction', 'out')->sum('amount');

        return (float) $this->opening_balance + (float) $in - (float) $out;
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * T2.4 : comptes visibles pour un utilisateur selon son rôle.
     *
     * `visible_roles = null` → caisse ouverte à tout le périmètre (caisse C).
     * Sinon seuls les rôles listés voient le compte (O/M/B, réservés à
     * l'administration et à la DG). Un utilisateur global voit tout.
     */
    public function scopeVisibleTo($query, ?User $user)
    {
        if (! $user) {
            return $query->whereRaw('1 = 0');
        }

        if (app(ScopeService::class)->isGlobal($user)) {
            return $query;
        }

        $role = $user->role?->name;

        return $query->where(function ($q) use ($role) {
            $q->whereNull('visible_roles')
                ->orWhereJsonContains('visible_roles', $role);
        });
    }

    public function isVisibleTo(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        if (app(ScopeService::class)->isGlobal($user)) {
            return true;
        }

        return $this->visible_roles === null
            || in_array($user->role?->name, $this->visible_roles, true);
    }

    public static function typeValidationRule(): string
    {
        return 'required|string|in:' . implode(',', self::TYPES);
    }

    /** Pays de l'Administration (dépense / écriture / caisse sans agence). */
    public function country(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_id');
    }
}
