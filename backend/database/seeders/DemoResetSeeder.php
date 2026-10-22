<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\AgencyCategory;
use App\Models\AgencyPaymentMethod;
use App\Models\Category;
use App\Models\City;
use App\Models\ClientTeamRole;
use App\Models\Commercial;
use App\Models\Country;
use App\Models\Course;
use App\Models\CourseCategory;
use App\Models\CourseModule;
use App\Models\Department;
use App\Models\Organization;
use App\Models\PrestationOffer;
use App\Models\PriceHistory;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\Setting;
use App\Models\SubscriptionPack;
use App\Models\TreasuryAccount;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Remise à zéro de la base locale avec un jeu de démo propre :
 * - 2 pays × 2 agences × 4 départements (academy, agency, store, studio) ;
 * - tous les comptes supprimés sauf admin@pekegno.com, puis recréés :
 *   1 directeur général par pays, 1 chef par agence, 1 chef par département,
 *   2 commerciaux et 1 caissier par agence (mot de passe : « password ») ;
 * - factures, ventes, catalogue vidés puis 2 éléments de chaque genre
 *   (produits, prestations, formations, packages, offres de prestation),
 *   chacun dans une catégorie différente.
 *
 * Conservés : rôles, permissions, réglages, organisation, catégories comptables.
 *
 * DESTRUCTIF — jamais appelé par DatabaseSeeder :
 *   php artisan db:seed --class=DemoResetSeeder
 */
class DemoResetSeeder extends Seeder
{
    private const ADMIN_EMAIL = 'admin@pekegno.com';

    private const KEEP_TABLES = [
        'migrations',
        'roles',
        'permissions',
        'role_permission',
        'organizations',
        'client_categories',
    ];

    private const COUNTRIES = [
        [
            'code' => 'CMR', 'iso_code' => 'CM', 'name' => 'Cameroun', 'phone_code' => '+237', 'currency_code' => 'XAF',
            'agencies' => [
                ['name' => 'Agence Douala Akwa', 'city' => 'Douala', 'short' => 'Douala'],
                ['name' => 'Agence Yaoundé Bastos', 'city' => 'Yaoundé', 'short' => 'Yaoundé'],
            ],
        ],
        [
            'code' => 'CIV', 'iso_code' => 'CI', 'name' => "Côte d'Ivoire", 'phone_code' => '+225', 'currency_code' => 'XOF',
            'agencies' => [
                ['name' => 'Agence Abidjan Plateau', 'city' => 'Abidjan', 'short' => 'Abidjan'],
                ['name' => 'Agence Bouaké Centre', 'city' => 'Bouaké', 'short' => 'Bouaké'],
            ],
        ],
    ];

    private const DEPARTMENTS = [
        Department::TYPE_ACADEMY => 'Academy',
        Department::TYPE_AGENCY => 'Agency',
        Department::TYPE_STORE => 'Store',
        Department::TYPE_STUDIO => 'Studio',
    ];

    /** Prénoms / noms tirés dans l'ordre pour des comptes lisibles et uniques. */
    private const FIRST_NAMES = [
        'Arnaud', 'Brice', 'Cédric', 'Diane', 'Estelle', 'Franck', 'Gaëlle', 'Hervé', 'Inès', 'Joël',
        'Kevin', 'Laure', 'Martial', 'Nadège', 'Olivier', 'Prisca', 'Quentin', 'Rita', 'Serge', 'Tatiana',
        'Ulrich', 'Vanessa', 'William', 'Xavier', 'Yvette', 'Zacharie', 'Aline', 'Boris', 'Carine', 'Didier',
        'Eric', 'Flore', 'Gilles', 'Hélène', 'Ismaël', 'Josiane', 'Karl', 'Linda', 'Moïse', 'Nina',
    ];

    private const LAST_NAMES = [
        'Abena', 'Bidjeck', 'Chendjou', 'Djomo', 'Essomba', 'Fouda', 'Guiffo', 'Hamadou', 'Ixe', 'Jiotsa',
        'Kamga', 'Lobe', 'Mballa', 'Nkoulou', 'Owona', 'Pokam', 'Quemba', 'Rikane', 'Simo', 'Tchoua',
        'Ulongo', 'Voufo', 'Wamba', 'Xenda', 'Yomba', 'Zeh', 'Atangana', 'Bekolo', 'Coulibaly', 'Diallo',
        'Ehui', 'Fofana', 'Gnaoré', 'Huberson', 'Irié', 'Jaurès', 'Koné', 'Lago', 'Méité', 'Ndri',
    ];

    private int $nameIndex = 0;

    /** @var array<string, string> */
    private array $roles = [];

    /** @var array<int, array{email: string, role: string, scope: string}> */
    private array $createdAccounts = [];

    public function run(): void
    {
        $admin = User::where('email', self::ADMIN_EMAIL)->first();
        if (! $admin) {
            $this->command?->error('Compte '.self::ADMIN_EMAIL.' introuvable : remise à zéro annulée.');

            return;
        }

        $this->roles = Role::pluck('id', 'name')->all();

        DB::transaction(function () use ($admin) {
            $this->wipe($admin);
            $this->seedStructure($admin);
        });

        // Règles de commission par défaut (grille de rémunération).
        $this->call(DefaultCommissionRulesSeeder::class);

        $this->report();
    }

    /**
     * Vide toutes les tables métier. Les lignes à garder qui seraient emportées
     * par le TRUNCATE ... CASCADE (compte admin, réglages, catégories
     * comptables globales) sont sauvegardées puis réinsérées.
     */
    private function wipe(User $admin): void
    {
        $adminRow = (array) DB::table('users')->where('id', $admin->id)->first();
        $settings = DB::table('settings')->get()->map(fn ($r) => (array) $r)->all();
        $accountingCategories = DB::table('accounting_categories')->whereNull('agency_id')->get()->map(fn ($r) => (array) $r)->all();

        $tables = collect(DB::select("select tablename from pg_tables where schemaname = 'public'"))
            ->pluck('tablename')
            ->reject(fn ($t) => in_array($t, self::KEEP_TABLES, true))
            ->map(fn ($t) => '"'.$t.'"')
            ->implode(', ');

        DB::statement("TRUNCATE TABLE {$tables} RESTART IDENTITY CASCADE");

        // Le compte admin ne pointe plus vers aucune donnée supprimée.
        foreach (['country_id', 'city_id', 'registered_agency_id', 'referring_commercial_id', 'commercial_user_id', 'client_category_id'] as $column) {
            if (array_key_exists($column, $adminRow)) {
                $adminRow[$column] = null;
            }
        }
        DB::table('users')->insert($adminRow);

        foreach ($settings as $row) {
            $row['updated_by'] = null;
            DB::table('settings')->insert($row);
        }

        foreach ($accountingCategories as $row) {
            DB::table('accounting_categories')->insert($row);
        }
    }

    private function seedStructure(User $admin): void
    {
        $organization = Organization::firstOrCreate(
            ['code' => 'PEKEGNO'],
            ['name' => 'PEKEGNO Group', 'is_active' => true],
        );

        $catalog = $this->seedGlobalCatalog();

        foreach (self::COUNTRIES as $countryDef) {
            $country = Country::create([
                'organization_id' => $organization->id,
                'code' => $countryDef['code'],
                'iso_code' => $countryDef['iso_code'],
                'name' => $countryDef['name'],
                'phone_code' => $countryDef['phone_code'],
                'currency_code' => $countryDef['currency_code'],
                'exchange_rate' => 1,
                'is_active' => true,
            ]);

            $agencies = [];
            foreach ($countryDef['agencies'] as $agencyDef) {
                $agencies[] = $this->seedAgency($organization, $country, $agencyDef, $admin);
            }

            // Directeur général : rattaché au pays (country_id) et à ses agences.
            $dg = $this->createUser('direction-generale', $countryDef['phone_code'], ['country_id' => $country->id]);
            foreach ($agencies as $agency) {
                $dg->assignments()->attach($agency->id, ['is_primary' => false, 'is_department_chief' => false, 'department_id' => null]);
            }
            $this->track($dg, 'direction-generale', $country->name);
        }

        // Les formations sont proposées dans toutes les agences (agency_id null).
        $this->command?->info(sprintf(
            'Catalogue : %d produits, %d prestations, %d formations, %d packages, %d offres de prestation.',
            Product::count(), Service::count(), Course::count(), SubscriptionPack::count(), PrestationOffer::count(),
        ));
        unset($catalog);
    }

    private function seedAgency(Organization $organization, Country $country, array $def, User $admin): Agency
    {
        $city = City::create(['country_id' => $country->id, 'name' => $def['city'], 'is_active' => true]);

        $agency = Agency::create([
            'code' => Agency::generateNextCode(),
            'name' => $def['name'],
            'type' => 'agency',
            'organization_id' => $organization->id,
            'country_id' => $country->id,
            'city_id' => $city->id,
            'country' => $country->name,
            'city' => $city->name,
            'address' => "Centre-ville, {$city->name}",
            'phone' => $country->phone_code.' 600 00 00 00',
            'email' => Str::slug($def['short']).'@pekegno.com',
        ]);

        $departments = [];
        foreach (self::DEPARTMENTS as $type => $label) {
            $departments[$type] = Department::create([
                'agency_id' => $agency->id,
                'name' => "{$label} {$def['short']}",
                'type' => $type,
            ]);
        }

        $this->seedTreasury($agency, $country);
        $this->seedAgencyDepartmentCatalog($departments[Department::TYPE_AGENCY], $admin);

        $phone = $country->phone_code;

        // Chef d'agence.
        $chief = $this->createUser('responsable-agence', $phone, ['country_id' => $country->id]);
        $chief->assignments()->attach($agency->id, ['is_primary' => true, 'is_department_chief' => false, 'department_id' => null]);
        $this->track($chief, 'responsable-agence', $agency->name);

        // Un chef par département.
        foreach ($departments as $department) {
            $deptChief = $this->createUser('responsable-departement', $phone, ['country_id' => $country->id]);
            $deptChief->assignments()->attach($agency->id, [
                'is_primary' => false,
                'is_department_chief' => true,
                'department_id' => $department->id,
            ]);
            DB::table('department_chiefs')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $deptChief->id,
                'department_id' => $department->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->track($deptChief, 'responsable-departement', $department->name);
        }

        // 2 commerciaux (avec leur profil commercial) et 1 caissier.
        for ($i = 0; $i < 2; $i++) {
            $commercial = $this->createUser('commercial', $phone, ['country_id' => $country->id]);
            $commercial->assignments()->attach($agency->id, ['is_primary' => false, 'is_department_chief' => false, 'department_id' => null]);
            Commercial::create([
                'user_id' => $commercial->id,
                'agency_id' => $agency->id,
                'kind' => 'commercial',
                'first_name' => $commercial->first_name,
                'last_name' => $commercial->last_name,
                'email' => $commercial->email,
                'phone' => $commercial->phone,
                'commission_type' => Setting::get('default_commission_type', 'percent'),
                'commission_value' => Setting::get('default_commission_value', 20),
                'points_balance' => 0,
                'is_active' => true,
            ]);
            $this->track($commercial, 'commercial', $agency->name);
        }

        $cashier = $this->createUser('caissier', $phone, ['country_id' => $country->id]);
        $cashier->assignments()->attach($agency->id, [
            'is_primary' => false,
            'is_department_chief' => false,
            'department_id' => $departments[Department::TYPE_STORE]->id,
        ]);
        $this->track($cashier, 'caissier', $agency->name);

        return $agency;
    }

    private function seedTreasury(Agency $agency, Country $country): void
    {
        $accounts = [
            ['name' => 'Caisse Principale', 'type' => 'cash', 'provider' => null],
            ['name' => 'Orange Money', 'type' => 'mobile_money', 'provider' => 'orange_money'],
            ['name' => 'MTN MoMo', 'type' => 'mobile_money', 'provider' => 'mtn_momo'],
        ];

        foreach ($accounts as $account) {
            TreasuryAccount::create($account + [
                'agency_id' => $agency->id,
                'opening_balance' => 0,
                'currency_code' => $country->currency_code,
                'is_active' => true,
            ]);
        }

        foreach (['orange_money', 'mtn_momo'] as $provider) {
            AgencyPaymentMethod::create([
                'agency_id' => $agency->id,
                'provider' => $provider,
                'phone_number' => $country->phone_code.' 690 00 00 00',
                'account_holder' => "PEKEGNO {$agency->city}",
                'is_active' => true,
            ]);
        }
    }

    /**
     * Catalogue global (toutes agences) : 2 produits, 2 prestations, 2 formations,
     * chacun dans une catégorie différente.
     */
    private function seedGlobalCatalog(): array
    {
        $categories = [];
        foreach ([
            'Livres' => ['description' => 'Livres et guides', 'color' => '#8B5CF6', 'icon' => 'book'],
            'Accessoires' => ['description' => 'Goodies et accessoires', 'color' => '#EC4899', 'icon' => 'shopping-bag'],
            'Conseil' => ['description' => 'Prestations de conseil', 'color' => '#10B981', 'icon' => 'briefcase'],
            'Design graphique' => ['description' => 'Création graphique', 'color' => '#F59E0B', 'icon' => 'clipboard'],
        ] as $name => $meta) {
            $categories[$name] = Category::create(['name' => $name] + $meta);
        }

        $products = [
            ['name' => 'Guide du e-commerce en Afrique', 'category' => 'Livres', 'price' => 8000],
            ['name' => 'Mug PEKEGNO', 'category' => 'Accessoires', 'price' => 5000],
        ];
        foreach ($products as $p) {
            Product::create([
                'sku' => Product::generateSku(),
                'name' => $p['name'],
                'description' => "Produit PEKEGNO : {$p['name']}.",
                'category_id' => $categories[$p['category']]->id,
                'brand' => 'PEKEGNO',
                'purchase_price' => (int) round($p['price'] * 0.6),
                'selling_price' => $p['price'],
                'tax_rate' => 0,
                'is_stock_managed' => false,
                'is_active' => true,
                'is_public' => true,
                'slug' => Str::slug($p['name']),
                'agency_id' => null,
            ]);
        }

        $services = [
            ['name' => 'Audit de présence digitale', 'category' => 'Conseil', 'price' => 75000],
            ['name' => 'Création de logo', 'category' => 'Design graphique', 'price' => 50000],
        ];
        foreach ($services as $s) {
            $service = Service::create([
                'code' => Service::generateCode(),
                'agency_id' => null,
                'category_id' => $categories[$s['category']]->id,
                'name' => $s['name'],
                'description' => "Prestation PEKEGNO : {$s['name']}.",
                'price' => $s['price'],
                'is_seminar' => false,
                'is_public' => true,
                'slug' => Str::slug($s['name']),
            ]);
            PriceHistory::create(['service_id' => $service->id, 'price' => $service->price, 'changed_at' => now()]);
        }

        $courseCategories = [
            'Marketing digital' => CourseCategory::create(['name' => 'Marketing digital', 'color' => '#3B82F6']),
            'Bureautique' => CourseCategory::create(['name' => 'Bureautique', 'color' => '#14B8A6']),
        ];
        $courses = [
            ['name' => 'Facebook Ads de A à Z', 'category' => 'Marketing digital', 'price' => 60000, 'mode' => 'in_person'],
            ['name' => 'Excel professionnel', 'category' => 'Bureautique', 'price' => 45000, 'mode' => 'online'],
        ];
        foreach ($courses as $c) {
            $course = Course::create([
                'code' => Course::generateCode(),
                'name' => $c['name'],
                'description' => "Formation certifiante : {$c['name']}.",
                'price' => $c['price'],
                'mode' => $c['mode'],
                'duration_hours' => 12,
                'duration_type' => 'hours',
                'agency_id' => null,
                'is_active' => true,
                'is_public' => true,
            ]);
            $course->categories()->attach($courseCategories[$c['category']]->id);
            foreach ([1 => 'Module 1', 2 => 'Module 2'] as $order => $name) {
                CourseModule::create(['course_id' => $course->id, 'name' => $name, 'order_index' => $order]);
            }
        }

        return $categories;
    }

    /**
     * Département Agency : rôles d'équipe client, 2 packages et 2 offres de
     * prestation, chacun dans une catégorie différente.
     */
    private function seedAgencyDepartmentCatalog(Department $department, User $admin): void
    {
        foreach (ClientTeamRole::DEFAULTS as $name) {
            ClientTeamRole::create(['department_id' => $department->id, 'name' => $name]);
        }

        $packages = [
            ['category' => 'Packages stratégiques', 'name' => 'Offre Starter', 'price' => 299000, 'original' => 370000],
            ['category' => 'Services à la carte', 'name' => 'Shooting professionnel', 'price' => 50000, 'original' => null],
        ];
        foreach ($packages as $order => $def) {
            $category = AgencyCategory::create([
                'department_id' => $department->id,
                'kind' => AgencyCategory::KIND_PACKAGE,
                'name' => $def['category'],
                'sort_order' => $order,
                'is_active' => true,
            ]);
            $package = SubscriptionPack::create([
                'code' => SubscriptionPack::generateCode(),
                'agency_id' => $department->agency_id,
                'department_id' => $department->id,
                'category_id' => $category->id,
                'name' => $def['name'],
                'price_per_month' => $def['price'],
                'original_price' => $def['original'],
                'billing_period' => 'monthly',
                'sort_order' => $order,
                'is_active' => true,
            ]);
            $package->items()->create([
                'label' => $def['name'],
                'quantity' => 1,
                'frequency' => 'per_month',
                'action_type' => $order === 0 ? 'advertising' : 'content_production',
            ]);
        }

        $offers = [
            ['category' => 'Réseaux sociaux', 'name' => 'Community management', 'description' => 'Animation quotidienne de vos réseaux sociaux.'],
            ['category' => 'Influence', 'name' => "Campagne d'influence", 'description' => "Sélection et pilotage d'influenceurs pour votre marque."],
        ];
        foreach ($offers as $def) {
            $category = AgencyCategory::create([
                'department_id' => $department->id,
                'kind' => AgencyCategory::KIND_PRESTATION,
                'name' => $def['category'],
                'is_active' => true,
            ]);
            PrestationOffer::create([
                'agency_id' => $department->agency_id,
                'department_id' => $department->id,
                'category_id' => $category->id,
                'name' => $def['name'],
                'description' => $def['description'],
                'is_active' => true,
                'created_by' => $admin->id,
            ]);
        }
    }

    private function createUser(string $role, string $phoneCode, array $extra = []): User
    {
        $first = self::FIRST_NAMES[$this->nameIndex % count(self::FIRST_NAMES)];
        $last = self::LAST_NAMES[$this->nameIndex % count(self::LAST_NAMES)];
        $this->nameIndex++;

        $username = Str::lower(Str::ascii($first).'.'.Str::ascii($last));

        return User::create(array_merge([
            'username' => $username,
            'email' => "{$username}@pekegno.com",
            'first_name' => $first,
            'last_name' => $last,
            'phone' => sprintf('%s 6%02d %02d %02d %02d', $phoneCode, 90, $this->nameIndex, 0, 0),
            'password' => Hash::make('password'),
            'role_id' => $this->roles[$role] ?? null,
            'is_active' => true,
            'is_password_change_required' => false,
        ], $extra));
    }

    private function track(User $user, string $role, string $scope): void
    {
        $this->createdAccounts[] = ['email' => $user->email, 'role' => $role, 'scope' => $scope];
    }

    private function report(): void
    {
        $this->command?->table(
            ['Email', 'Rôle', 'Périmètre'],
            array_map(fn ($a) => [$a['email'], $a['role'], $a['scope']], $this->createdAccounts),
        );
        $this->command?->info('Mot de passe de tous les comptes créés : password');
    }
}
