<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    use HasUuids;

    protected $fillable = [
        'invoice_id',
        'service_id',
        'category_id',
        'product_id',
        'package_id',
        'prestation_id',
        'label',
        'unit_price',
        'quantity',
        'line_total',
        'is_pass_through',
        'pass_tier',
        'pass_label',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'quantity' => 'integer',
            'line_total' => 'decimal:2',
            'is_pass_through' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        // B4 / T8.1 : toute ligne rattachée à un service ou à un produit hérite de
        // sa catégorie, même lorsque l'appelant ne la renseigne pas (vente rapide,
        // packages, inscriptions, commandes…).
        static::creating(function (InvoiceItem $item) {
            if ($item->category_id) {
                return;
            }

            $item->category_id = match (true) {
                $item->service_id !== null => Service::query()->whereKey($item->service_id)->value('category_id'),
                $item->product_id !== null => Product::query()->whereKey($item->product_id)->value('category_id'),
                default => null,
            };
        });
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'package_id');
    }

    public function prestation(): BelongsTo
    {
        return $this->belongsTo(Prestation::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
