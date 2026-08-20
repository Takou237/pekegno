<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasUuids, Notifiable;

    protected $fillable = [
        'username',
        'email',
        'password',
        'first_name',
        'last_name',
        'phone',
        'role_id',
        'is_active',
        'failed_attempts',
        'locked_until',
        'two_factor_enabled',
        'two_factor_secret',
        'active_session_id',
        'is_password_change_required',
        'last_activity_at',
        'client_number',
        'client_category_id',
        'status',
        'registered_agency_id',
        'commercial_user_id',
        'registered_at',
        'city',
        'country',
        'country_id',
        'city_id',
        'address',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
    ];

    protected $with = ['role'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'failed_attempts' => 'integer',
            'locked_until' => 'datetime',
            'two_factor_enabled' => 'boolean',
            'is_password_change_required' => 'boolean',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'registered_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function clientCategory(): BelongsTo
    {
        return $this->belongsTo(ClientCategory::class);
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

    public function registeredAgency(): BelongsTo
    {
        return $this->belongsTo(Agency::class, 'registered_agency_id');
    }

    public function referringCommercial(): BelongsTo
    {
        return $this->belongsTo(User::class, 'commercial_user_id');
    }

    public function clientSubscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class, 'client_id');
    }

    // Affectations via user_assignments (agence + département)
    public function assignments(): BelongsToMany
    {
        return $this->belongsToMany(Agency::class, 'user_assignments')
            ->withPivot('department_id', 'is_primary', 'is_department_chief')
            ->withTimestamps();
    }

    public function primaryAgency()
    {
        return $this->belongsToMany(Agency::class, 'user_assignments')
            ->wherePivot('is_primary', true)
            ->withPivot('department_id', 'is_primary', 'is_department_chief')
            ->withTimestamps();
    }

    public function commercialProfile(): HasOne
    {
        return $this->hasOne(Commercial::class, 'user_id');
    }

    public function invoicesSold(): HasMany
    {
        return $this->hasMany(Invoice::class, 'seller_user_id');
    }

    public function clientInvoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'client_id');
    }

    public function receivedPayments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class, 'received_by');
    }

    public function createdPoints(): HasMany
    {
        return $this->hasMany(CommercialPoint::class, 'created_by');
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function getIsClientAttribute(): bool
    {
        return $this->role?->name === 'client';
    }

    public static function generateClientNumber(): string
    {
        $last = static::where('client_number', 'like', 'CL-%')
            ->pluck('client_number')
            ->map(fn (string $number): int => preg_match('/^CL-(\d+)$/', $number, $matches) ? (int) $matches[1] : 0)
            ->max();

        return 'CL-'.str_pad((string) (($last ?: 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->role?->name === 'super-admin') {
            return true;
        }

        return in_array($permission, $this->permissionNames(), true);
    }

    public function hasAnyPermission(array $permissions): bool
    {
        if ($this->role?->name === 'super-admin') {
            return true;
        }

        return count(array_intersect($permissions, $this->permissionNames())) > 0;
    }

    private function permissionNames(): array
    {
        if ($this->cachedPermissionNames === null) {
            $this->cachedPermissionNames = $this->role?->permissions()->pluck('name')->all() ?? [];
        }

        return $this->cachedPermissionNames;
    }

    private ?array $cachedPermissionNames = null;
}
