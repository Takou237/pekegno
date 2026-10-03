<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Bloc « Nos recommandations » d'un package (ex. 02 commerciaux). */
class PackageRecommendation extends Model
{
    use HasUuids;

    protected $fillable = [
        'package_id',
        'client_team_role_id',
        'label',
        'quantity',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'package_id');
    }

    public function teamRole(): BelongsTo
    {
        return $this->belongsTo(ClientTeamRole::class, 'client_team_role_id');
    }
}
