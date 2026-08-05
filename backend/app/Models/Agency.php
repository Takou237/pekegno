<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Agency extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'country',
        'city',
        'address',
        'phone',
        'email',
    ];

    protected $with = ['departments'];

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
