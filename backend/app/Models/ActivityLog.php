<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    use HasUuids;

    const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'agency_id',
        'country_id',
        'action',
        'entity_type',
        'entity_id',
        'description',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Le super-admin et ses actions ne sont visibles que d'un super-admin :
     * le directeur général (et tout autre rôle) ne voit ni les actions faites
     * par un super-admin, ni celles qui portent sur un compte super-admin.
     */
    public function scopeHideSuperAdminFrom($query, ?User $viewer)
    {
        if ($viewer?->isSuperAdmin()) {
            return $query;
        }

        $superAdminIds = User::whereHas('role', fn ($q) => $q->where('name', 'super-admin'))->withTrashed()->select('id');

        return $query
            ->where(fn ($q) => $q->whereNull('activity_logs.user_id')->orWhereNotIn('activity_logs.user_id', $superAdminIds))
            ->where(fn ($q) => $q->where('activity_logs.entity_type', '!=', 'user')
                ->orWhereNull('activity_logs.entity_id')
                ->orWhereNotIn('activity_logs.entity_id', User::whereHas('role', fn ($r) => $r->where('name', 'super-admin'))->withTrashed()->select('id')));
    }
}
