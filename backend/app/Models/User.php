<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasUuids;

    protected $fillable = [
        'username',
        'email',
        'password',
        'first_name',
        'last_name',
        'phone',
        'is_active',
        'is_super_admin',
        'two_factor_enabled',
        'must_change_password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_super_admin' => 'boolean',
            'two_factor_enabled' => 'boolean',
            'must_change_password' => 'boolean',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->morphToMany(Role::class, 'model', 'model_has_roles');
    }

    public function agencies(): BelongsToMany
    {
        return $this->belongsToMany(Agency::class, 'user_assignments')
            ->withPivot('is_primary', 'department_id')
            ->withTimestamps();
    }

    public function managedAgencies(): HasMany
    {
        return $this->hasMany(Agency::class, 'manager_id');
    }

    public function managedDepartments(): HasMany
    {
        return $this->hasMany(Department::class, 'manager_id');
    }
}
