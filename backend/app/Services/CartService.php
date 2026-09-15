<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\Product;
use App\Models\Service;

/**
 * Service de panier : panier persistant par client, prix recalculés côté
 * serveur (aucune confiance accordée au prix envoyé par le client).
 */
class CartService
{
    public function getOrCreate(string $userId): Cart
    {
        return Cart::firstOrCreate(['user_id' => $userId]);
    }

    /**
     * Payload du panier : articles enrichis (prix officiel, disponibilité,
     * image) + agences disponibles pour le passage en caisse + totaux.
     *
     * @return array<string, mixed>
     */
    public function payload(Cart $cart): array
    {
        $cart->loadMissing([
            'agency:id,name,city',
            'items.service:id,name,price,is_public,is_seminar,cover_image,slug,category_id,agency_id',
            'items.product:id,name,selling_price,tax_rate,is_public,is_active,cover_image,slug,category_id,agency_id',
            'items.service.category:id,name',
            'items.product.category:id,name',
            'items.service.agency:id,name,city',
            'items.product.agency:id,name,city',
        ]);

        $lines = $cart->items->map(function ($item) {
            $service = $item->service;
            $product = $item->product;

            $available = false;
            $type = null;
            $name = $item->id;
            $unitPrice = 0.0;
            $effectivePrice = 0.0;
            $coverImage = null;
            $slug = null;
            $categoryName = null;
            $reason = null;
            $agency = null;

            if ($service) {
                $type = 'service';
                $name = $service->name;
                $unitPrice = (float) $service->price;
                $effectivePrice = (float) $service->effective_price;
                $coverImage = $service->cover_image;
                $slug = $service->slug;
                $categoryName = $service->category->name ?? null;
                $available = (bool) $service->is_public;
                $agency = $service->agency;
                if (! $service->is_public) {
                    $reason = 'indisponible';
                }
            } elseif ($product) {
                $type = 'product';
                $name = $product->name;
                $unitPrice = (float) $product->selling_price;
                $effectivePrice = (float) $product->selling_price;
                $coverImage = $product->cover_image;
                $slug = $product->slug;
                $categoryName = $product->category->name ?? null;
                $available = (bool) ($product->is_public && $product->is_active);
                $agency = $product->agency;
                if (! $available) {
                    $reason = 'indisponible';
                }
            }

            return [
                'id' => $item->id,
                'type' => $type,
                'service_id' => $item->service_id,
                'product_id' => $item->product_id,
                'service' => $item->service_id ? ['id' => $item->service_id] : null,
                'product' => $item->product_id ? ['id' => $item->product_id] : null,
                'name' => $name,
                // Agence propriétaire de l'article (service/produit) : permet au front
                // d'afficher directement l'agence de commande sans redemander de
                // sélectionner, tant que tous les articles du panier partagent la même.
                'agency_id' => $agency?->id,
                'agency_name' => $agency?->name,
                'unit_price' => $service ? (float) $service->price : ($product ? (float) $product->selling_price : 0.0),
                'effective_price' => $effectivePrice,
                'quantity' => $item->quantity,
                'line_total' => round($effectivePrice * $item->quantity, 2),
                'available' => $available,
                'reason' => $reason,
                'cover_image' => $coverImage,
                'slug' => $slug,
                'category_name' => $categoryName,
            ];
        });

        $total = round($lines->sum('line_total'), 2);
        $count = $lines->sum('quantity');

        return [
            'id' => $cart->id,
            'agency_id' => $cart->agency_id,
            'agency' => $cart->agency,
            'items' => $lines->values(),
            'total' => $total,
            'count' => $count,
        ];
    }

    /**
     * Applique les totaux du panier connecté sur la caisse (checkout).
     * Les prix clients sont ignorés : on repart sur les prix officiels.
     *
     * @return array<int, array<string, mixed>>
     */
    public function buildLinesFromCart(Cart $cart): array
    {
        $lines = [];

        foreach ($cart->items as $item) {
            if ($item->service_id) {
                $service = Service::findOrFail($item->service_id);
                $lines[] = [
                    'line_type' => 'catalog',
                    'service_id' => $service->id,
                    'product_id' => null,
                    'label' => $service->name,
                    'description' => null,
                    'unit_price' => (float) $service->effective_price,
                    'quantity' => $item->quantity,
                    'line_total' => round((float) $service->effective_price * $item->quantity, 2),
                ];
            } elseif ($item->product_id) {
                $product = Product::findOrFail($item->product_id);
                $sellingPrice = (float) $product->selling_price;
                $lines[] = [
                    'line_type' => 'catalog',
                    'service_id' => null,
                    'product_id' => $product->id,
                    'label' => $product->name,
                    'description' => null,
                    'unit_price' => $sellingPrice,
                    'quantity' => $item->quantity,
                    'line_total' => round($sellingPrice * $item->quantity, 2),
                ];
            }
        }

        return $lines;
    }
}