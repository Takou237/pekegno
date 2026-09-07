<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\Service;
use Illuminate\Support\Facades\DB;

/**
 * Factorise la construction des lignes de commande et la génération de la
 * facture depuis une commande (logique partagée entre le back-office
 * OrderController et l'espace client ClientCheckoutController).
 */
class OrderInvoicingService
{
    public function __construct(
        private readonly InvoiceNumberGenerator $invoiceNumber,
    ) {}

    /**
     * Construit les lignes avec snapshot du prix : catalogue = prix du service
     * (surchargeable), manuel = prix saisi. Les occurrences multiples d'un même
     * service sont autorisées.
     *
     * @param  array<int, array<string, mixed>>  $lines
     * @return array<int, array<string, mixed>>
     */
    public function buildLines(array $lines): array
    {
        $result = [];

        foreach ($lines as $line) {
            $type = $line['line_type'] ?? 'catalog';
            $quantity = (int) ($line['quantity'] ?? 1);

            $unitPrice = null;
            $label = null;
            $serviceId = null;

            if ($type === 'catalog' && ! empty($line['service_id'])) {
                $service = Service::findOrFail($line['service_id']);
                $serviceId = $service->id;
                $label = $service->name;
                $unitPrice = array_key_exists('unit_price', $line) && $line['unit_price'] !== null
                    ? (float) $line['unit_price']
                    : (float) $service->price;
            } else {
                $label = $line['label'];
                $unitPrice = (float) ($line['unit_price'] ?? 0);
            }

            $unitPrice = round(max(0, $unitPrice), 2);

            $result[] = [
                'line_type' => $type,
                'service_id' => $serviceId,
                'label' => $label,
                'description' => $line['description'] ?? null,
                'unit_price' => $unitPrice,
                'quantity' => $quantity,
                'line_total' => round($unitPrice * $quantity, 2),
            ];
        }

        return $result;
    }

    /**
     * Crée la facture à partir d'une commande (statut completed + invoice_id).
     * Les commandes distantes (commercial_online / client_self) passent par le
     * workflow de validation : validation_status=pending, source=online.
     * Les commandes en personne (in_person) sont directement validées.
     */
    public function invoiceFromOrder(Order $order, string $actorUserId): Invoice
    {
        return DB::transaction(function () use ($order, $actorUserId) {
            $client = $order->client;

            $isRemote = in_array($order->channel, ['commercial_online', 'client_self'], true);

            $invoice = Invoice::create([
                'number' => $this->invoiceNumber->next(),
                'agency_id' => $order->agency_id,
                'client_id' => $order->client_id,
                'client_name' => $client ? trim("{$client->first_name} {$client->last_name}") : null,
                'commercial_id' => $order->commercial_id,
                'seller_user_id' => $actorUserId,
                'invoice_date' => now(),
                'payment_type' => null,
                'total_amount' => $order->total_amount,
                'amount_paid' => 0,
                'discount' => $order->discount,
                'vat_rate' => $order->vat_rate,
                'status' => 'unpaid',
                'validation_status' => $isRemote ? Invoice::VALIDATION_PENDING : Invoice::VALIDATION_VALIDATED,
                'source' => $isRemote ? 'online' : 'in_person',
                'comment' => "Commande {$order->number}",
            ]);

            foreach ($order->lines as $line) {
                $invoice->items()->create([
                    'service_id' => $line->service_id,
                    'label' => $line->label,
                    'unit_price' => $line->unit_price,
                    'quantity' => $line->quantity,
                    'line_total' => $line->line_total,
                ]);
            }

            $order->update(['status' => 'completed', 'invoice_id' => $invoice->id]);

            return $invoice;
        });
    }
}
