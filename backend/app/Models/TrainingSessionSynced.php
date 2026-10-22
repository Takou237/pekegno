<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TrainingSessionSynced extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'training_sessions_synced';

    protected $fillable = [
        'source_session_id',
        'training_session_id',
        'agency_id',
        'course_id',
        'status',
        'start_at',
        'end_at',
        'location',
        'max_capacity',
        'price',
        'trainer_id',
        'module_id',
        'source_user_id',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'max_capacity' => 'integer',
        'price' => 'decimal:2',
    ];

    public function agency()
    {
        return $this->belongsTo(Agency::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }
}
