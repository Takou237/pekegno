<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Catégorie Agency (D2) : catégorie de packages ou de prestations. */
class AgencyCategory extends Model
{
    use HasUuids, SoftDeletes;

    public const KIND_PACKAGE = 'package';

    public const KIND_PRESTATION = 'prestation';

    public const KINDS = [self::KIND_PACKAGE, self::KIND_PRESTATION];

    protected $fillable = [
        'department_id',
        'kind',
        'name',
        'description',
        'color',
        'icon',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function packages(): HasMany
    {
        return $this->hasMany(SubscriptionPack::class, 'category_id');
    }

    public function prestations(): HasMany
    {
        return $this->hasMany(Prestation::class, 'category_id');
    }
}
