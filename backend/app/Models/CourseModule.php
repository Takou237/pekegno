<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CourseModule extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'course_modules';

    protected $fillable = [
        'course_id',
        'name',
        'description',
        'order_index',
        'duration_hours',
        'trainer_id',
    ];

    protected function casts(): array
    {
        return [
            'order_index' => 'integer',
            'duration_hours' => 'integer',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(Trainer::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(TrainingSession::class, 'module_id');
    }

    /**
     * Formateur effectif : priorité au formateur du module, sinon null (on utilisera le trainer de la session).
     */
    public function effectiveTrainerId(): ?string
    {
        return $this->trainer_id;
    }
}
