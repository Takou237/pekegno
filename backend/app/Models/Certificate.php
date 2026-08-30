<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Certificate extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'certificates';

    public const STATUS_ISSUED = 'issued';
    public const STATUS_REVOKED = 'revoked';

    public const STATUSES = [
        self::STATUS_ISSUED,
        self::STATUS_REVOKED,
    ];

    protected $fillable = [
        'enrollment_id',
        'number',
        'issued_on',
        'mention',
        'status',
        'revoked_reason',
        'file_path',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'issued_on' => 'date',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(FormationEnrollment::class, 'enrollment_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function generateNextNumber(): string
    {
        $last = static::withTrashed()->orderByDesc('number')->value('number');
        $next = $last ? ((int) substr($last, 6)) + 1 : 1;

        return 'CERT-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }

    public function scopeOfStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }
}
