<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Agency extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'type',
        'organization_id',
        'country_id',
        'city_id',
        'country',
        'city',
        'address',
        'phone',
        'email',
    ];

    protected $with = ['departments'];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Relations vers la hiérarchie organisationnelle.
     * Nommées geo* car les colonnes legacy `country`/`city` (varchar)
     * occupent déjà les noms magiques correspondants.
     */
    public function geoCountry(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_id');
    }

    public function geoCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city_id');
    }

    public function isAgency(): bool
    {
        return $this->hasActivity('agency');
    }

    public function isAcademy(): bool
    {
        return $this->hasActivity('academy');
    }

    public function isMixed(): bool
    {
        return $this->hasActivity('agency') && $this->hasActivity('academy');
    }

    /**
     * Lignes de métier de l'agence (agency = prestations, academy = formations).
     */
    public function activities(): HasMany
    {
        return $this->hasMany(AgencyActivity::class);
    }

    /**
     * L'agence exerce-t-elle la ligne de métier donnée ?
     * Se base sur les activités chargées, sinon retombe sur la colonne legacy `type`.
     */
    public function hasActivity(string $type): bool
    {
        if ($this->relationLoaded('activities')) {
            return $this->activities->contains(
                fn (AgencyActivity $activity) => $activity->type === $type && $activity->is_active
            );
        }

        return in_array($type, match ($this->type) {
            'academy' => ['academy'],
            'mixed' => ['agency', 'academy'],
            default => ['agency'],
        }, true);
    }

    /**
     * Déduit le type legacy depuis les lignes de métier actives.
     *
     * @param  array<int, array{type: string, is_active?: bool}>|null  $activities
     */
    public static function deriveType(?array $activities): string
    {
        $active = collect($activities ?? [])
            ->where('is_active', true)
            ->pluck('type')
            ->all();

        $hasAgency = in_array('agency', $active, true);
        $hasAcademy = in_array('academy', $active, true);

        if ($hasAgency && $hasAcademy) {
            return 'mixed';
        }

        if ($hasAcademy) {
            return 'academy';
        }

        return 'agency';
    }

    /**
     * Synchronise les lignes de métier de l'agence. Par défaut, les deux sont actives.
     *
     * @param  array<int, array{type: string, is_active?: bool}>|null  $activities
     */
    public function syncActivities(?array $activities): void
    {
        $activities ??= [
            ['type' => 'agency', 'is_active' => true],
            ['type' => 'academy', 'is_active' => true],
        ];

        foreach ($activities as $activity) {
            $type = $activity['type'] ?? null;
            if (! in_array($type, AgencyActivity::TYPES, true)) {
                continue;
            }

            $this->activities()->updateOrCreate(
                ['type' => $type],
                ['is_active' => (bool) ($activity['is_active'] ?? true)],
            );
        }
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function assignedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_assignments')
            ->withPivot('department_id', 'is_primary', 'is_department_chief')
            ->withTimestamps();
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * Chiffre d'affaires : somme des factures payées non annulées.
     */
    public function getTurnoverAttribute(): float
    {
        return round((float) $this->invoices()
            ->where('status', 'paid')
            ->whereNull('cancelled_at')
            ->sum('total_amount'), 2);
    }

    public function scopeSearch($query, ?string $search)
    {
        if (! $search) {
            return $query;
        }

        return $query->where(function ($q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
                ->orWhere('code', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('city', 'like', "%{$search}%")
                ->orWhere('country', 'like', "%{$search}%");
        });
    }

    public function scopeByCountry($query, ?string $country)
    {
        if (! $country) {
            return $query;
        }

        return $query->where('country', $country);
    }

    public static function generateNextCode(): string
    {
        $lastCode = static::withTrashed()
            ->where('code', 'LIKE', 'AG%')
            ->pluck('code')
            ->map(function (string $code): int {
                return preg_match('/^AG(\d+)$/', $code, $matches) ? (int) $matches[1] : 0;
            })
            ->max();

        $next = ($lastCode ?: 0) + 1;

        return 'AG'.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    public function getFullAddressAttribute(): ?string
    {
        $parts = collect([$this->address, $this->city, $this->country])->filter();

        return $parts->implode(', ') ?: null;
    }
}
