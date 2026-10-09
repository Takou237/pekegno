<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\AgencyPaymentMethod;
use App\Models\Country;
use App\Models\Course;
use App\Models\PrestationOffer;
use App\Models\Product;
use App\Models\Service;
use App\Models\SubscriptionPack;
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

    public function courses(Request $request): JsonResponse
    {
        $models = Course::query()
            ->with(['categories', 'agency'])
            ->withCount(['sessions' => fn ($q) => $q->where(fn ($w) => $w->whereNull('end_at')->orWhere('end_at', '>=', now()))])
            ->public()
            ->when($request->category_id, fn ($q, $value) => $q->whereHas('categories', fn ($c) => $c->where('course_categories.id', $value)))
            ->when($request->agency_id, fn ($q, $value) => $q->availableIn($value))
            ->when($request->filled('country_id'), function ($q) use ($request) {
                $q->where(function ($inner) use ($request) {
                    $inner->whereNull('agency_id')
                        ->orWhereHas('agency', fn ($agency) => $agency->where('country_id', $request->country_id));
                });
            })
            ->orderBy('name')
            ->get();

        // Vue "tous pays" (ni country_id ni agency_id) : une formation créée à la fois
        // dans plusieurs agences/pays produit une ligne par agence. On les regroupe par
        // nom pour éviter les doublons visuels du catalogue, avec la liste des lieux
        // où elle est disponible.
        if (! $request->filled('country_id') && ! $request->filled('agency_id')) {
            $courses = $models->groupBy('name')
                ->map(function ($group) {
                    $representative = $group->sortBy(fn (Course $c) => (float) $c->effective_price)->first();

                    return $this->serializeCourse($representative, $group);
                })
                ->values();
        } else {
            $courses = $models->map(fn (Course $course) => $this->serializeCourse($course));
        }

        return response()->json($courses);
    }

    public function course(Request $request, string $course): JsonResponse
    {
        $model = Course::query()
            ->with(['categories', 'agency'])
            ->public()
            ->where(function ($q) use ($course) {
                if (Str::isUuid($course)) {
                    $q->where('id', $course)->orWhere('slug', $course);
                } else {
                    $q->where('slug', $course);
                }
            })
            ->firstOrFail();

        // Autres agences où la même formation (même nom) est aussi proposée, pour
        // permettre de basculer vers son agence locale depuis la fiche.
        $siblings = Course::query()
            ->with('agency')
            ->public()
            ->where('name', $model->name)
            ->get();

        $payload = $this->serializeCourse($model, $siblings->count() > 1 ? $siblings : null);
        $payload['objective'] = $model->objective;
        $payload['prerequisites'] = $model->prerequisites;
        $payload['presentation_video'] = $model->presentation_video;
        $payload['duration_hours'] = $model->duration_hours;
        $payload['duration_type'] = $model->duration_type;
        $payload['duration_months'] = $model->duration_months;
        $payload['sessions'] = $model->sessions()
            ->where(fn ($q) => $q->whereNull('end_at')->orWhere('end_at', '>=', now()))
            ->whereNot('status', 'cancelled')
            ->orderBy('start_at')
            ->get()
            ->map(fn ($session) => [
                'id' => $session->id,
                'start_at' => $session->start_at,
                'end_at' => $session->end_at,
                'max_capacity' => $session->max_capacity,
                'enrolled_count' => $session->participants()->where('status', 'enrolled')->count(),
            ]);

        return response()->json($payload);
    }

    /**
     * D24 : le catalogue Packages du portail client couvre toute la plateforme.
     * Seuls les packs publics et actifs sont exposés — aucune souscription ici.
     */
    public function packages(Request $request): JsonResponse
    {
        $packages = SubscriptionPack::query()
            ->with(['category:id,name,icon,color', 'agency:id,name,city,country,phone,email', 'items', 'recommendations.teamRole:id,name', 'promotions'])
            ->where('is_public', true)
            ->where('is_active', true)
            ->when($request->filled('search'), function ($q) use ($request) {
                // Comparaison insensible à la casse : `like` est sensible à la casse sur PostgreSQL
                // alors qu'il ne l'est pas sur SQLite (tests) — on normalise des deux côtés.
                $needle = '%' . mb_strtolower($request->string('search')->toString()) . '%';
                $q->where(fn ($inner) => $inner
                    ->whereRaw('lower(name) like ?', [$needle])
                    ->orWhereRaw('lower(tagline) like ?', [$needle])
                    ->orWhereRaw('lower(code) like ?', [$needle]));
            })
            ->when($request->filled('agency_id'), fn ($q, $value) => $q->where('agency_id', $value))
            ->when($request->filled('category_id'), fn ($q, $value) => $q->where('category_id', $value))
            ->when($request->filled('country_id'), function ($q) use ($request) {
                $q->where(function ($inner) use ($request) {
                    $inner->whereNull('agency_id')
                        ->orWhereHas('agency', fn ($agency) => $agency->where('country_id', $request->country_id));
                });
            })
            ->orderBy('sort_order')
            ->orderBy('name')
            ->when($request->filled('per_page'), fn ($q) => $q->take(min($request->integer('per_page', 50), 100)))
            ->get();

        // Une seule carte par nom : les packs homonymes des différentes agences sont
        // regroupés. L'exemplaire principal porte le prix, `agencies` liste toutes les
        // agences (avec leur propre `package_id`) pour que le client choisisse la sienne.
        $grouped = $packages->groupBy('name')->map(function ($group) {
            $payload = $this->serializePackage($group->first());
            $agencies = $group
                ->map(fn (SubscriptionPack $pack) => $this->agencyOffer($pack))
                ->filter()
                ->unique('id')
                ->values();
            $payload['agencies'] = $agencies;
            $payload['agency_count'] = $agencies->count();

            return $payload;
        })->values();

        return response()->json($grouped);
    }

    public function package(string $package): JsonResponse
    {
        $model = SubscriptionPack::query()
            ->with(['category:id,name,icon,color', 'agency:id,name,city,country,phone,email', 'items', 'recommendations.teamRole:id,name', 'promotions'])
            ->where('is_public', true)
            ->where('is_active', true)
            ->where('id', $package)
            ->firstOrFail();

        $payload = $this->serializePackage($model);

        $siblings = SubscriptionPack::query()
            ->with('agency:id,name,city,country,phone,email')
            ->where('is_public', true)
            ->where('is_active', true)
            ->where('name', $model->name)
            ->orderBy('sort_order')
            ->get();

        $agencies = $siblings
            ->map(fn (SubscriptionPack $pack) => $this->agencyOffer($pack))
            ->filter()
            ->unique('id')
            ->values();

        // L'agence du pack consulté passe en premier.
        $agencies = $agencies->sortBy(fn (array $offer) => $offer['package_id'] === $model->id ? 0 : 1)->values();

        $payload['agencies'] = $agencies;
        $payload['agency_count'] = $agencies->count();

        return response()->json($payload);
    }

    /** Offre d'une agence pour un pack homonyme : permet au client de souscrire « son » pack. */
    private function agencyOffer(SubscriptionPack $package): ?array
    {
        $agency = $package->agency;
        if (! $agency) {
            return null;
        }

        return [
            'id' => $agency->id,
            'name' => $agency->name,
            'city' => $agency->city,
            'country' => $agency->country,
            'phone' => $agency->phone,
            'email' => $agency->email,
            'package_id' => $package->id,
        ];
    }

    /**
     * Offres de prestation Agency pour l'onglet Packages du site public :
     * seules les offres actives sont exposées (lecture seule, aucune
     * souscription ici — comme les packs, la souscription se fait en agence
     * ou depuis l'espace client).
     */
    public function offers(Request $request): JsonResponse
    {
        $offers = PrestationOffer::query()
            ->with(['category:id,name,color', 'agency:id,name,city,country'])
            ->withCount('subscriptions')
            ->where('is_active', true)
            ->when($request->filled('search'), function ($q) use ($request) {
                $needle = '%'.mb_strtolower($request->string('search')->toString()).'%';
                $q->where(fn ($inner) => $inner
                    ->whereRaw('lower(name) like ?', [$needle])
                    ->orWhereRaw('lower(description) like ?', [$needle]));
            })
            ->when($request->filled('agency_id'), fn ($q, $value) => $q->where('agency_id', $value))
            ->when($request->filled('category_id'), fn ($q, $value) => $q->where('category_id', $value))
            ->when($request->filled('country_id'), function ($q) use ($request) {
                $q->whereHas('agency', fn ($agency) => $agency->where('country_id', $request->country_id));
            })
            ->orderBy('name')
            ->when($request->filled('per_page'), fn ($q) => $q->take(min($request->integer('per_page', 50), 100)))
            ->get()
            ->map(fn (PrestationOffer $offer) => $this->serializeOffer($offer));

        return response()->json($offers);
    }

    public function agencyPaymentMethods(Agency $agency): JsonResponse
    {
        $methods = AgencyPaymentMethod::query()
            ->where('agency_id', $agency->id)
            ->where('is_active', true)
            // Le virement bancaire n'est pas proposé au client sur le site : il
            // reste réservé aux paiements gérés en agence.
            ->where('provider', '!=', 'bank_transfer')
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

    /**
     * @param \Illuminate\Support\Collection<int, Course>|null $group Toutes les lignes
     *        (une par agence) de la même formation, quand regroupée pour la vue "tous pays".
     */
    private function serializeCourse(Course $course, ?\Illuminate\Support\Collection $group = null): array
    {
        return [
            'id' => $course->id,
            'slug' => $course->slug ?? $course->id,
            'code' => $course->code,
            'name' => $course->name,
            'description' => $course->description,
            'mode' => $course->mode,
            'price' => (string) $course->price,
            'effective_price' => (string) $course->effective_price,
            'cover_image' => $course->cover_image,
            'sessions_count' => $course->sessions_count ?? 0,
            'categories' => $course->categories->map(fn ($category) => [
                'id' => $category->id,
                'name' => $category->name,
                'color' => $category->color,
            ]),
            'agency' => $course->agency ? [
                'id' => $course->agency->id,
                'name' => $course->agency->name,
                'city' => $course->agency->city,
                'country' => $course->agency->country,
            ] : null,
            'available_at' => $group && $group->count() > 1
                ? $group->map(fn (Course $c) => $c->agency ? [
                    'course_id' => $c->id,
                    'slug' => $c->slug ?? $c->id,
                    'agency_id' => $c->agency->id,
                    'agency_name' => $c->agency->name,
                    'country' => $c->agency->country,
                ] : null)->filter()->values()
                : null,
        ];
    }

    private function serializeOffer(PrestationOffer $offer): array
    {
        return [
            'id' => $offer->id,
            'name' => $offer->name,
            'description' => $offer->description,
            'is_active' => (bool) $offer->is_active,
            'subscriptions_count' => $offer->subscriptions_count ?? 0,
            'category' => $offer->category ? [
                'id' => $offer->category->id,
                'name' => $offer->category->name,
                'color' => $offer->category->color,
            ] : null,
            'agency' => $offer->agency ? [
                'id' => $offer->agency->id,
                'name' => $offer->agency->name,
                'city' => $offer->agency->city,
                'country' => $offer->agency->country,
            ] : null,
        ];
    }

    private function serializePackage(SubscriptionPack $package): array
    {
        return [
            'id' => $package->id,
            'code' => $package->code,
            'name' => $package->name,
            'tagline' => $package->tagline,
            'description' => $package->description,
            'prerequisites' => $package->prerequisites,
            'price_per_month' => (string) $package->price_per_month,
            'original_price' => $package->original_price !== null ? (string) $package->original_price : null,
            'price_is_starting_from' => (bool) $package->price_is_starting_from,
            'effective_price' => (string) $package->effective_price,
            'billing_period' => $package->billing_period,
            'min_duration_months' => $package->min_duration_months,
            'cover_image' => $package->cover_image,
            'category' => $package->category ? [
                'id' => $package->category->id,
                'name' => $package->category->name,
                'icon' => $package->category->icon,
                'color' => $package->category->color,
            ] : null,
            'agency' => $package->agency ? [
                'id' => $package->agency->id,
                'name' => $package->agency->name,
                'city' => $package->agency->city,
                'country' => $package->agency->country,
                'phone' => $package->agency->phone,
                'email' => $package->agency->email,
            ] : null,
            'items' => $package->items->map(fn ($item) => [
                'id' => $item->id,
                'label' => $item->label,
                'quantity' => $item->quantity,
                'frequency' => $item->frequency,
                'action_type' => $item->action_type,
            ]),
            'recommendations' => $package->recommendations->map(fn ($recommendation) => [
                'id' => $recommendation->id,
                'label' => $recommendation->label,
                'quantity' => $recommendation->quantity,
                'teamRole' => $recommendation->teamRole ? [
                    'id' => $recommendation->teamRole->id,
                    'name' => $recommendation->teamRole->name,
                ] : null,
            ]),
            'promotions' => $package->promotions->map(fn ($promotion) => [
                'type' => $promotion->type,
                'promo_price' => $promotion->promo_price !== null ? (string) $promotion->promo_price : null,
                'discount_percent' => $promotion->discount_percent !== null ? (string) $promotion->discount_percent : null,
                'start_date' => $promotion->start_date?->toISOString(),
                'end_date' => $promotion->end_date?->toISOString(),
                'is_active' => $promotion->isActive(),
            ]),
        ];
    }
}
