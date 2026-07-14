<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
    ];

    protected $with = ['departments'];

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    // Utilisateurs assignés à cette agence (via user_assignments)
    public function assignedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_assignments')
            ->withPivot('department_id', 'is_primary')
            ->withTimestamps();
    }
}
