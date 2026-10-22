<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'description',
    ];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permission');
    }

    /** Règles de commission attribuées à ce rôle (par groupe de règle). */
    public function commissionRuleGroupIds(): array
    {
        return \Illuminate\Support\Facades\DB::table('commission_rule_role')
            ->where('role_id', $this->id)
            ->pluck('rule_group_id')
            ->all();
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
