<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Rôle métier de l'équipe client Agency (Community manager, Graphiste…).
 * Aucune permission applicative n'y est rattachée.
 */
class ClientTeamRole extends Model
{
    use HasUuids, SoftDeletes;

    public const DEFAULTS = [
        'Community manager',
        'Account manager',
        'Graphiste',
        'Vidéaste',
        'Media buyer',
        'Commercial',
        'Coach',
    ];

    protected $fillable = [
        'department_id',
        'name',
        'description',
        'color',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(PrestationTeamMember::class);
    }
}
