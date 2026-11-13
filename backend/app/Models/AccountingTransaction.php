<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountingTransaction extends Model
{
    use HasUuids;

    protected $fillable = [
        'number',
        'agency_id',
        'country_id',
        'department_id',
        'category_id',
        'treasury_account_id',
        'type',
        'is_transfer',
        'is_pass_through',
        'label',
        'reference',
        'amount',
        'client_id',
        'invoice_id',
        'transacted_at',
        'operator_id',
        'note',
        'beneficiary',
        'justification',
    ];

    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'amount' => 'decimal:2',
            'transacted_at' => 'datetime',
            'is_transfer' => 'boolean',
            'is_pass_through' => 'boolean',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function treasuryAccount(): BelongsTo
    {
        return $this->belongsTo(TreasuryAccount::class);
    }

    /** Catégories / libellés qui désignent un transfert entre caisses (B13). */
    public const TRANSFER_PATTERN = '/versement|virement|d[ée]p[ôo]t (en|à la) banque|bancaire|transfert|d[ée]caissement admin/iu';

    public static function looksLikeTransfer(?string $category, ?string $label = null): bool
    {
        return preg_match(self::TRANSFER_PATTERN, (string) $category) === 1
            || preg_match(self::TRANSFER_PATTERN, (string) $label) === 1;
    }

    /** Charges réelles : dépenses hors transferts entre caisses (B13, T2.7). */
    protected static function booted(): void
    {
        // Une écriture dans une catégorie « budget pub client » (pass-through)
        // n'est jamais une dépense d'exploitation (CdC §8.2), même saisie à la main.
        static::creating(function (self $tx) {
            if (! $tx->is_pass_through && $tx->category_id
                && AccountingCategory::whereKey($tx->category_id)->where('is_pass_through', true)->exists()) {
                $tx->is_pass_through = true;
            }
        });
    }

    public function scopeRealExpenses($query)
    {
        // Colonnes qualifiées : la table est jointe à accounting_categories,
        // qui porte aussi une colonne `type`.
        return $query->where('accounting_transactions.type', 'expense')
            ->where('accounting_transactions.is_transfer', false);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AccountingCategory::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    /** Pays de l'Administration (dépense / écriture / caisse sans agence). */
    public function country(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_id');
    }
}
