<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Offre de prestation (ex. « Campagne Facebook ») : fiche simple (nom,
 * catégorie) à laquelle les clients souscrivent. La souscription elle-même
 * reste une prestation (budget, période, contrat, actions, notes).
 */
class PrestationOffer extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'agency_id',
        'department_id',
        'category_id',
        'name',
        'description',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AgencyCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Souscriptions clients à cette offre (les prestations issues d'un pack n'ont pas d'offre). */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Prestation::class, 'offer_id');
    }
}
