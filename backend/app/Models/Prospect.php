<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Prospect extends Model
{
    use HasUuids;

    protected $fillable = [
        'commercial_id',
        'agency_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'city',
        'country',
        'address',
        'notes',
        'created_by',
    ];

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(Commercial::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getFullNameAttribute(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }
}
