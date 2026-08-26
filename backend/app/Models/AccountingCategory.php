<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountingCategory extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'type',
        'agency_id',
        'is_system',
        'is_pass_through',
    ];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'is_pass_through' => 'boolean',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(AccountingTransaction::class);
    }
}
