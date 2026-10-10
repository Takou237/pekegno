<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrestationTeamMember extends Model
{
    use HasUuids;

    protected $fillable = [
        'prestation_id',
        'user_id',
        'team_member_id',
        'client_team_role_id',
        'is_lead',
        'start_date',
        'end_date',
    ];

    protected function casts(): array
    {
        return [
            'is_lead' => 'boolean',
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function prestation(): BelongsTo
    {
        return $this->belongsTo(Prestation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function teamRole(): BelongsTo
    {
        return $this->belongsTo(ClientTeamRole::class, 'client_team_role_id');
    }

    public function teamMember(): BelongsTo
    {
        return $this->belongsTo(TeamMember::class);
    }
}
