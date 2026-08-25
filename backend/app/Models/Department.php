<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\Rule;

class Department extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    public const TYPE_ACADEMY = 'academy';
    public const TYPE_AGENCY = 'agency';
    public const TYPE_STORE = 'store';
    public const TYPE_STUDIO = 'studio';

    public const TYPES = [
        self::TYPE_ACADEMY,
        self::TYPE_AGENCY,
        self::TYPE_STORE,
        self::TYPE_STUDIO,
    ];

    protected $fillable = [
        'agency_id',
        'name',
        'type',
        'description',
    ];

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

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

    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeOfTypes($query, array $types)
    {
        return $query->whereIn('type', $types);
    }

    public static function typeValidationRule(): array
    {
        return ['required', 'string', Rule::in(self::TYPES)];
    }
}
