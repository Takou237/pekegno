<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Commercial;
use App\Models\CommercialPoint;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\PriceHistory;
use App\Models\Prospect;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Données de test pour les commerciaux (phase 5) :
 * - Profils commerciaux liés aux utilisateurs seeds
 * - Services de catalogue (si absents)
 * - Clients, prospects, commandes + factures payées et points
 */
class CommercialTestDataSeeder extends Seeder
{
    public function run(): void
    {
        $douala = Agency::where('name', 'Agence Principale Douala')->first();
        $yaounde = Agency::where('name', 'Agence Yaoundé Centre')->first();
        $clientRole = Role::where('name', 'client')->first();
        $caissier = User::where('email', 'youssef.hamid@pekegno.com')->first();

        $this->ensureServices($douala);
        $services = Service::pluck('price', 'name')->all();

        $commercials = [];
        $carlosUser = User::where('email', 'carlos.fotso@pekegno.com')->first();
        $fatimaUser = User::where('email', 'fatima.bello@pekegno.com')->first();

        if ($carlosUser) {
            $commercials['carlos'] = Commercial::firstOrCreate(
                ['user_id' => $carlosUser->id],
                [
                    'agency_id' => $douala?->id,
                    'kind' => 'commercial',
                    'first_name' => 'Carlos',
                    'last_name' => 'Fotso',
                    'email' => 'carlos.fotso@pekegno.com',
                    'phone' => '+237 690 000 006',
                    'commission_type' => 'percent',
                    'commission_value' => 5,
                    'points_balance' => 120,
                    'is_active' => true,
                ]
            );
        }

        if ($fatimaUser) {
            $commercials['fatima'] = Commercial::firstOrCreate(
                ['user_id' => $fatimaUser->id],
                [
                    'agency_id' => $douala?->id,
                    'kind' => 'commercial',
                    'first_name' => 'Fatima',
                    'last_name' => 'Bello',
                    'email' => 'fatima.bello@pekegno.com',
                    'phone' => '+237 690 000 007',
                    'commission_type' => 'percent',
                    'commission_value' => 4,
                    'points_balance' => 85,
                    'is_active' => true,
                ]
            );
        }

        if (! $commercials) {
            $this->command?->warn('Aucun utilisateur commercial trouvé, abandon.');

            return;
        }

        $clients = $this->ensureClients($clientRole);
        $this->seedProspects($commercials['carlos'] ?? null, $douala);
        $this->seedSales($commercials, $clients, $douala, $yaounde, $caissier, $services);

        $this->command?->info('Données de test commercial créées avec succès.');
    }
private function ensureServices(?Agency $agency): void
    {
        if (! $agency) {
            return;
        }

        $categories = [
            ['name' => 'Formations', 'color' => '#3B82F6', 'icon' => 'book'],
            ['name' => 'Conseil', 'color' => '#10B981', 'icon' => 'briefcase'],
            ['name' => 'Audit', 'color' => '#F59E0B', 'icon' => 'clipboard'],
        ];

        $categoryIds = [];
        foreach ($categories as $cat) {
            $c = Category::updateOrCreate(
                ['name' => $cat['name']],
                ['color' => $cat['color'], 'icon' => $cat['icon']]
            );
            $categoryIds[$cat['name']] = $c->id;
        }

        $catalog = [
            ['name' => 'Formation Excel Avancé', 'category' => 'Formations', 'price' => 50000],
            ['name' => 'Formation Marketing Digital', 'category' => 'Formations', 'price' => 75000],
            ['name' => 'Conseil en organisation', 'category' => 'Conseil', 'price' => 120000],
            ['name' => 'Audit comptable', 'category' => 'Audit', 'price' => 200000],
        ];

        foreach ($catalog as $item) {
            $service = Service::updateOrCreate(
                ['name' => $item['name']],
                [
                    'category_id' => $categoryIds[$item['category']],
                    'agency_id' => $agency->id,
                    'description' => "Service de test : {$item['name']}",
                    'price' => $item['price'],
                ]
            );

            if (! PriceHistory::where('service_id', $service->id)->exists()) {
                PriceHistory::create([
                    'service_id' => $service->id,
                    'price' => $service->price,
                    'changed_at' => now(),
                ]);
            }
        }
    }

    /**
     * @return array<string, User>
     */
    private function ensureClients(?Role $clientRole): array
    {
        $data = [
            'alice' => ['email' => 'alice.client@test.com', 'first_name' => 'Alice', 'last_name' => 'Mballa'],
            'brice' => ['email' => 'brice.client@test.com', 'first_name' => 'Brice', 'last_name' => 'Nkoulou'],
            'claire' => ['email' => 'claire.client@test.com', 'first_name' => 'Claire', 'last_name' => 'Abena'],
        ];

        $clients = [];
        foreach ($data as $key => $d) {
            $clients[$key] = User::firstOrCreate(
                ['email' => $d['email']],
                [
                    'username' => strtolower($d['first_name']).'.tclient',
                    'password' => Hash::make('password'),
                    'first_name' => $d['first_name'],
                    'last_name' => $d['last_name'],
                    'role_id' => $clientRole?->id,
                    'is_active' => true,
                    'is_password_change_required' => false,
                ]
            );
        }

        return $clients;
    }
private function seedProspects(?Commercial $commercial, ?Agency $agency): void
    {
        if (! $commercial || ! $agency) {
            return;
        }

        $prospects = [
            ['first_name' => 'Daniel', 'last_name' => 'Wamba', 'phone' => '+237 655 111 111', 'city' => 'Douala', 'notes' => 'Intéressé par la formation Excel'],
            ['first_name' => 'Estelle', 'last_name' => 'Tchoua', 'phone' => '+237 699 222 222', 'city' => 'Yaoundé', 'notes' => 'Demande de conseil en organisation'],
            ['first_name' => 'Franck', 'last_name' => 'Kouadio', 'phone' => '+225 07 55 333 333', 'city' => 'Abidjan', 'notes' => 'Audit comptable envisagé'],
        ];

        foreach ($prospects as $p) {
            Prospect::firstOrCreate(
                ['email' => strtolower($p['first_name']).'.'.$p['last_name'].'@test.com'],
                [
                    'commercial_id' => $commercial->id,
                    'agency_id' => $agency->id,
                    'first_name' => $p['first_name'],
                    'last_name' => $p['last_name'],
                    'phone' => $p['phone'],
                    'city' => $p['city'],
                    'country' => 'Cameroun',
                    'notes' => $p['notes'],
                    'created_by' => $commercial->user_id,
                ]
            );
        }
    }
private function seedSales(
        array $commercials,
        array $clients,
        ?Agency $douala,
        ?Agency $yaounde,
        ?User $caissier,
        array $services
    ): void {
        if (! $douala || ! $yaounde || ! $caissier || empty($services)) {
            return;
        }

        // Elements : [commercial, client, agence, "Service:qty,Service:qty", mois, points, statut]
        $specs = [
            ['carlos', 'alice', 'douala', 'Formation Excel Avancé:1', '2', '50', 'paid'],
            ['carlos', 'brice', 'douala', 'Formation Marketing Digital:1,Conseil en organisation:1', '1', '60', 'paid'],
            ['carlos', 'claire', 'yaounde', 'Audit comptable:1', '0', '40', 'paid'],
            ['fatima', 'alice', 'douala', 'Formation Excel Avancé:2', '3', '45', 'paid'],
            ['fatima', 'brice', 'yaounde', 'Conseil en organisation:1', '1', '35', 'paid'],
            ['carlos', 'alice', 'douala', 'Formation Marketing Digital:1', '0', '0', 'pending'],
        ];

        foreach ($specs as $i => $s) {
            [$commKey, $clientKey, $agencyKey, $itemsSpec, $monthsAgo, $points, $payStatus] = $s;
            $commercial = $commercials[$commKey];
            $client = $clients[$clientKey];
            $agency = $agencyKey === 'douala' ? $douala : $yaounde;

            $months = (int) $monthsAgo;
            $pointsInt = (int) $points;
            $orderDate = now()->subMonths($months);

            $lines = [];
            $subtotal = 0.0;

            $pairs = explode(',', $itemsSpec);
            foreach ($pairs as $pair) {
                [$serviceName, $qtyStr] = explode(':', $pair);
                $qty = (int) $qtyStr;
                $price = (float) ($services[$serviceName] ?? 50000);
                $subtotal += $price * $qty;
                $lines[] = [
                    'line_type' => 'catalog',
                    'service_id' => Service::where('name', $serviceName)->value('id'),
                    'label' => $serviceName,
                    'unit_price' => $price,
                    'quantity' => $qty,
                    'line_total' => round($price * $qty, 2),
                ];
            }

            $order = Order::firstOrCreate(
                ['number' => 'CMD-TEST-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT)],
                [
                    'agency_id' => $agency->id,
                    'client_id' => $client->id,
                    'commercial_id' => $commercial->id,
                    'status' => 'completed',
                    'channel' => 'in_person',
                    'order_date' => $orderDate->toDateString(),
                    'subtotal' => $subtotal,
                    'discount' => 0,
                    'vat_rate' => 0,
                    'total_amount' => $subtotal,
                    'notes' => 'Vente test commercial',
                ]
            );

            foreach ($lines as $line) {
                if (! OrderLine::where('order_id', $order->id)->where('label', $line['label'])->exists()) {
                    $order->lines()->create($line);
                }
            }
$invoiceNumber = 'FAC-TEST-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            $invoice = Invoice::where('number', $invoiceNumber)->first();

            if (! $invoice) {
                $invoice = Invoice::create([
                    'number' => $invoiceNumber,
                    'agency_id' => $agency->id,
                    'client_id' => $client->id,
                    'client_name' => trim("{$client->first_name} {$client->last_name}"),
                    'commercial_id' => $commercial->id,
                    'seller_user_id' => $commercial->user_id,
                    'invoice_date' => $orderDate->copy()->addDays(1),
                    'payment_type' => $payStatus === 'paid' ? 'cash' : null,
                    'total_amount' => $subtotal,
                    'amount_paid' => $payStatus === 'paid' ? $subtotal : 0,
                    'discount' => 0,
                    'vat_rate' => 0,
                    'status' => $payStatus === 'pending' ? 'unpaid' : $payStatus,
                    'validation_status' => $payStatus === 'pending' ? Invoice::VALIDATION_PENDING : Invoice::VALIDATION_VALIDATED,
                    'validated_by' => $payStatus === 'pending' ? null : $caissier->id,
                    'validated_at' => $payStatus === 'pending' ? null : $orderDate->copy()->addDays(1),
                    'source' => 'in_person',
                    'commission_amount' => round($commercial->commissionFor($subtotal), 2),
                    'points_awarded' => $pointsInt,
                    'comment' => "Commande {$order->number}",
                ]);

                foreach ($lines as $line) {
                    InvoiceItem::create([
                        'invoice_id' => $invoice->id,
                        'service_id' => $line['service_id'],
                        'label' => $line['label'],
                        'unit_price' => $line['unit_price'],
                        'quantity' => $line['quantity'],
                        'line_total' => $line['line_total'],
                    ]);
                }

                if ($payStatus === 'paid') {
                    InvoicePayment::create([
                        'invoice_id' => $invoice->id,
                        'amount' => $subtotal,
                        'payment_method' => 'cash',
                        'is_advance' => false,
                        'paid_at' => $orderDate->copy()->addDays(1),
                        'received_by' => $caissier->id,
                        'comment' => 'Paiement test',
                    ]);
                }

                if ($payStatus === 'paid' && ! CommercialPoint::where('commercial_id', $commercial->id)->where('invoice_id', $invoice->id)->exists()) {
                    CommercialPoint::create([
                        'commercial_id' => $commercial->id,
                        'points' => $pointsInt,
                        'reason' => 'sale',
                        'invoice_id' => $invoice->id,
                        'created_by' => $commercial->user_id,
                    ]);
                }

                $order->update(['invoice_id' => $invoice->id]);
            }
        }
    }
}
