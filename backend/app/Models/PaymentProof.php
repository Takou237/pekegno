<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentProof extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_ACCEPTED,
        self::STATUS_REJECTED,
    ];

    protected $appends = ['file_url'];

    protected $fillable = [
        'invoice_id',
        'submitted_by',
        'payment_method',
        'phone_number_used',
        'reference',
        'amount',
        'file_path',
        'status',
        'reviewed_by',
        'reviewed_at',
        'rejection_code',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'reviewed_at' => 'datetime',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * URL de consultation du fichier, servie par l'API.
     *
     * L'ancienne URL pointait vers `/storage/...`, qui dépendait du lien
     * symbolique et du disque de l'instance : sur Render (disque éphémère, lien
     * parfois absent), les preuves s'affichaient cassées. La route API signée
     * fonctionne dans un `<img src>` et survit aux changements d'hébergement.
     */
    public function getFileUrlAttribute(): ?string
    {
        if (! $this->file_path) {
            return null;
        }

        return \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'payment-proofs.file',
            now()->addHours(12),
            ['proof' => $this->getKey()]
        );
    }
}
