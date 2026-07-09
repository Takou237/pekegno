<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Agency extends Model
{
    use HasUuids;

    protected $fillable = [
        'code',
        'name',
        'country',
        'city',
        'address',
        'phone',
        'email',
        'manager_id',
    ];

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_assignments')
            ->withPivot('is_primary', 'department_id')
            ->withTimestamps();
    }
}
