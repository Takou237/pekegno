<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
        'two_factor_enabled',
        'two_factor_secret',
        'active_session_id',
        'is_password_change_required',
        'last_activity_at',
        'client_number',
        'city',
        'country',
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
            'two_factor_enabled' => 'boolean',
            'is_password_change_required' => 'boolean',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
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
