<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FormationEnrollment extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'formation_enrollments';

    protected $fillable = [
        'course_id',
        'learner_user_id',
        'invoice_id',
        'seller_user_id',
        'seller_trainer_id',
        'enrolled_at',
        'status',
        'notes',
        'discount_type',
        'discount_value',
    ];

    public const DISCOUNT_TYPE_AMOUNT = 'amount';

    public const DISCOUNT_TYPE_PERCENT = 'percent';

    protected function casts(): array
    {
        return [
            'enrolled_at' => 'datetime',
            'discount_value' => 'decimal:2',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function learner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'learner_user_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_user_id');
    }

    public function sellerTrainer(): BelongsTo
    {
        return $this->belongsTo(Trainer::class, 'seller_trainer_id');
    }

    public function sessionParticipants(): HasMany
    {
        return $this->hasMany(SessionParticipant::class, 'formation_enrollment_id');
    }
}
