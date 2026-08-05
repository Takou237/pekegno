<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

class Department extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'agency_id',
        'name',
        'description',
    ];

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    // Utilisateurs assignés à ce département (via user_assignments)
    public function assignedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_assignments')
            ->withPivot('agency_id', 'is_primary', 'is_department_chief')
            ->withTimestamps();
    }

    public function chief(): HasOneThrough
    {
        return $this->hasOneThrough(
            User::class,
            DepartmentChief::class,
            'department_id',
            'id',
            'id',
            'user_id'
        );
    }
}
