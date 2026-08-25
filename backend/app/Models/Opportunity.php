<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Opportunity extends Model
{
    use HasUuids, SoftDeletes;

    public const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

    protected $fillable = [
        'title',
        'prospect_id',
        'client_id',
        'company_id',
        'agency_id',
        'department_id',
        'commercial_id',
        'stage',
        'expected_amount',
        'expected_close_date',
        'won_at',
        'lost_at',
        'loss_reason',
    ];

    protected function casts(): array
    {
        return [
            'expected_amount' => 'decimal:2',
            'expected_close_date' => 'date',
            'won_at' => 'datetime',
            'lost_at' => 'datetime',
        ];
    }

    public function prospect(): BelongsTo
    {
        return $this->belongsTo(Prospect::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(Commercial::class);
    }

    public function activities(): HasMany
    {
        return $this->morphMany(Activity::class, 'subject');
    }

    public function scopeOfStage($query, string $stage)
    {
        return $query->where('stage', $stage);
    }

    public function scopeOfCommercial($query, string $commercialId)
    {
        return $query->where('commercial_id', $commercialId);
    }

    public function scopeOfAgency($query, string $agencyId)
    {
        return $query->where('agency_id', $agencyId);
    }

    public function scopeWon($query)
    {
        return $query->where('stage', 'won');
    }

    public function scopeOpen($query)
    {
        return $query->whereNotIn('stage', ['won', 'lost']);
    }
}
