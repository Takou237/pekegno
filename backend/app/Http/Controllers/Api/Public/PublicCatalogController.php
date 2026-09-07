<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\AgencyPaymentMethod;
use App\Models\Country;
use App\Models\Product;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Catalogue public (non authentifié) : pays, agences, services et
 * produits vendables sur la boutique client.
 */
class PublicCatalogController extends Controller
{
    public function countries(): JsonResponse
    {
        $countries = Country::query()
            ->where('is_active', true)
            ->withCount('agencies')
            ->orderBy('name')
            ->get()
            ->map(fn (Country $country) => [
                'id' => $country->id,
                'name' => $country->name,
                'code' => $country->code,
                'iso_code' => $country->iso_code,
                'phone_code' => $country->phone_code,
                'currency_code' => $country->currency_code,
                'agencies_count' => $country->agencies_count,
            ]);

        return response()->json($countries);
    }

    public function agencies(Request $request): JsonResponse
    {
        $agencies = Agency::query()
            ->withCount('paymentMethods')
            ->when($request->country_id, fn ($q, $value) => $q->where('country_id', $value))
            ->orderBy('name')
            ->get()
            ->map(fn (Agency $agency) => [
                'id' => $agency->id,
                'name' => $agency->name,
                'code' => $agency->code,
                'city' => $agency->city,
                'country' => $agency->country,
                'address' => $agency->address,
                'phone' => $agency->phone,
                'email' => $agency->email,
                'payment_methods_count' => $agency->payment_methods_count,
            ]);

        return response()->json($agencies);
    }

    public function services(Request $request): JsonResponse
    {
        $services = Service::query()
            ->with(['category', 'agency'])
            ->public()
            ->when($request->category_id, fn ($q, $value) => $q->where('category_id', $value))
            ->when($request->agency_id, fn ($q, $value) => $q->availableIn($value))
            ->when($request->filled('country_id'), function ($q) use ($request) {
                $q->where(function ($inner) use ($request) {
                    $inner->whereNull('agency_id')
                        ->orWhereHas('agency', fn ($agency) => $agency->where('country_id', $request->country_id));
                });
            })
            ->orderBy('name')
            ->get()
            ->map(fn (Service $service) => $this->serializeService($service));

        return response()->json($services);
    }

    public function service(Request $request, string $service): JsonResponse
    {
        $model = Service::query()
            ->with(['category', 'agency', 'promotions', 'seminarTiers'])
            ->where('is_public', true)
            ->where(function ($q) use ($service) {
                if (Str::isUuid($service)) {
                    $q->where('id', $service)->orWhere('slug', $service);
                } else {
                    $q->where('slug', $service);
                }
            })
            ->firstOrFail();

        $payload = $this->serializeService($model);
        $payload['presentation_video'] = $model->presentation_video;
        $payload['promotions'] = $model->promotions
            ->map(fn ($promotion) => [
                'type' => $promotion->type,
                'promo_price' => $promotion->promo_price !== null ? (string) $promotion->promo_price : null,
                'discount_percent' => $promotion->discount_percent !== null ? (string) $promotion->discount_percent : null,
                'start_date' => $promotion->start_date?->toISOString(),
                'end_date' => $promotion->end_date?->toISOString(),
                'is_active' => $promotion->isActive(),
            ]);
        $payload['seminar_tiers'] = $model->is_seminar
            ? $model->seminarTiers->map(fn ($tier) => [
                'tier' => $tier->tier,
                'label' => $tier->label,
                'price' => (string) $tier->price,
                'description' => $tier->description,
            ])
            : [];

        return response()->json($payload);
    }

    public function products(Request $request): JsonResponse
    {
        $products = Product::query()
            ->with(['category', 'agency'])
            ->where('is_public', true)
            ->when($request->category_id, fn ($q, $value) => $q->where('category_id', $value))
            ->when($request->agency_id, fn ($q, $value) => $q->availableIn($value))
            ->when($request->filled('country_id'), function ($q) use ($request) {
                $q->where(function ($inner) use ($request) {
                    $inner->whereNull('agency_id')
                        ->orWhereHas('agency', fn ($agency) => $agency->where('country_id', $request->country_id));
                });
            })
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product) => $this->serializeProduct($product));

        return response()->json($products);
    }

    public function product(Request $request, string $product): JsonResponse
    {
        $model = Product::query()
            ->with(['category', 'agency'])
            ->where('is_public', true)
            ->where(function ($q) use ($product) {
                if (Str::isUuid($product)) {
                    $q->where('id', $product)->orWhere('slug', $product);
                } else {
                    $q->where('slug', $product);
                }
            })
            ->firstOrFail();

        return response()->json($this->serializeProduct($model));
    }

    public function agencyPaymentMethods(Agency $agency): JsonResponse
    {
        $methods = AgencyPaymentMethod::query()
            ->where('agency_id', $agency->id)
            ->where('is_active', true)
            ->get()
            ->map(fn (AgencyPaymentMethod $method) => [
                'id' => $method->id,
                'provider' => $method->provider,
                'phone_number' => $method->phone_number,
                'account_holder' => $method->account_holder,
                'instructions' => $method->instructions,
            ]);

        return response()->json($methods);
    }

    private function serializeService(Service $service): array
    {
        return [
            'id' => $service->id,
            'slug' => $service->slug ?? $service->id,
            'name' => $service->name,
            'description' => $service->description,
            'price' => (string) $service->price,
            'effective_price' => (string) $service->effective_price,
            'is_seminar' => (bool) $service->is_seminar,
            'cover_image' => $service->cover_image,
            'category' => $service->category ? [
                'id' => $service->category->id,
                'name' => $service->category->name,
                'icon' => $service->category->icon,
                'color' => $service->category->color,
            ] : null,
            'agency' => $service->agency ? [
                'id' => $service->agency->id,
                'name' => $service->agency->name,
                'city' => $service->agency->city,
                'country' => $service->agency->country,
            ] : null,
        ];
    }

    private function serializeProduct(Product $product): array
    {
        return [
            'id' => $product->id,
            'slug' => $product->slug ?? $product->id,
            'name' => $product->name,
            'description' => $product->description,
            'brand' => $product->brand,
            'selling_price' => (string) $product->selling_price,
            'price_with_tax' => (string) $product->price_with_tax,
            'tax_rate' => (string) $product->tax_rate,
            'cover_image' => $product->cover_image,
            'category' => $product->category ? [
                'id' => $product->category->id,
                'name' => $product->category->name,
                'icon' => $product->category->icon,
                'color' => $product->category->color,
            ] : null,
            'agency' => $product->agency ? [
                'id' => $product->agency->id,
                'name' => $product->agency->name,
                'city' => $product->agency->city,
                'country' => $product->agency->country,
            ] : null,
        ];
    }
}