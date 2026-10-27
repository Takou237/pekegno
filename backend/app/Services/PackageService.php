<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\SubscriptionPack;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Packages Agency : souscription d'un client à un package.
 * D1 : chaque package souscrit crée un NOUVEAU contrat (plusieurs packages = plusieurs contrats).
 * D3 : la souscription génère une prestation pré-remplie (une action par item du package).
 */
class PackageService
{
    public function __construct(
        private readonly ContractService $contracts,
        private readonly AgencyInvoicingService $invoicing,
        private readonly PaymentService $payments,
        private readonly ActivityLogger $logger,
    ) {}

    public function effectivePrice(SubscriptionPack $package): float
    {
        return $package->effective_price;
    }

    /**
     * @param  ?array{file_path: string, payment_method: string, phone_number_used?: ?string, reference?: ?string}  $paymentProof
     *         Preuve photo jointe à la souscription : créée en « pending » et examinée
     *         par le caissier avant validation de la facture.
     * @return array{contract: Contract, prestation: Prestation, invoice: Invoice}
     */
    public function subscribe(
        SubscriptionPack $package,
        User $client,
        Carbon $start,
        int $periods,
        ?string $commercialId,
        string $actorUserId,
        ?string $departmentId = null,
        bool $autoRenew = false,
        ?float $advance = null,
        ?string $paymentType = null,
        bool $needsValidation = false,
        ?array $paymentProof = null,
        ?string $discountType = null,
        ?float $discountValue = null,
    ): array {
        if (! $package->is_active) {
            throw ValidationException::withMessages(['package' => 'Ce package est inactif.']);
        }

        if ($client->role?->name !== 'client') {
            throw ValidationException::withMessages(['client_id' => 'Le client lié doit avoir le rôle client.']);
        }

        if ($package->min_duration_months) {
            $months = (SubscriptionPack::PERIOD_MONTHS[$package->billing_period] ?? 1) * $periods;
            if ($months < $package->min_duration_months) {
                throw ValidationException::withMessages([
                    'periods' => "Ce package impose un engagement minimum de {$package->min_duration_months} mois.",
                ]);
            }
        }

        $unitPrice = $this->effectivePrice($package);
        $subtotal = round($unitPrice * $periods, 2);

        if ($discountType === 'percent' && $discountValue !== null && $discountValue > 0) {
            if ($discountValue > 100) {
                throw ValidationException::withMessages(['discount_value' => 'Le pourcentage de remise doit être inférieur ou égal à 100.']);
            }
        } elseif ($discountType === 'amount' && $discountValue !== null && $discountValue > 0) {
            if ($discountValue > $subtotal) {
                throw ValidationException::withMessages(['discount_value' => 'La remise ne peut pas dépasser le montant total.']);
            }
        }

        $discountAmount = 0.0;
        if ($discountType === 'percent' && $discountValue !== null && $discountValue > 0) {
            $discountAmount = round($subtotal * ($discountValue / 100), 2);
        } elseif ($discountType === 'amount' && $discountValue !== null && $discountValue > 0) {
            $discountAmount = round($discountValue, 2);
        }
        $total = round(max(0, $subtotal - $discountAmount), 2);

        if ($advance !== null && $advance > $total) {
            $advance = $total;
        }

        return DB::transaction(function () use (
            $package, $client, $start, $periods, $commercialId, $actorUserId, $departmentId,
            $autoRenew, $advance, $paymentType, $needsValidation, $paymentProof, $unitPrice, $discountType, $discountValue
        ) {
            $package->loadMissing('items');

            $contract = $this->contracts->createFromPackage(
                $package, $client->id, $start, $periods, $unitPrice, $commercialId, $departmentId, $autoRenew,
            );

            $prestation = $this->generatePrestation($package, $contract, $actorUserId);

            $invoice = $this->invoicing->invoiceForPackage(
                $contract,
                $package,
                $periods,
                $unitPrice,
                $actorUserId,
                $paymentType,
                $advance !== null && $advance > 0 ? $advance : null,
                $needsValidation,
                $discountType,
                $discountValue,
            );

            $this->logger->log(
                action: 'subscribed',
                entityType: 'subscription-pack',
                entityId: $package->id,
                description: "Souscription de {$client->first_name} {$client->last_name} au package {$package->name} — contrat {$contract->number}, facture {$invoice->number}",
                newValues: ['contract' => $contract->number, 'prestation' => $prestation->reference, 'invoice' => $invoice->number],
                agencyId: $contract->agency_id,
            );

            // Preuve photo de paiement : reste « pending » jusqu'à l'examen par le
            // caissier, qui encaisse l'avance au moment d'accepter la preuve.
            if ($paymentProof !== null) {
                PaymentProof::create([
                    'invoice_id' => $invoice->id,
                    'submitted_by' => $actorUserId,
                    'payment_method' => $paymentProof['payment_method'] ?? ($paymentType ?? 'cash'),
                    'phone_number_used' => $paymentProof['phone_number_used'] ?? null,
                    'reference' => $paymentProof['reference'] ?? null,
                    'file_path' => $paymentProof['file_path'],
                    'status' => PaymentProof::STATUS_PENDING,
                ]);
            }

            // Encaissement immédiat seulement si la facture est définitive. Une facture
            // en attente de validation garde l'avance en « declared_advance » : elle sera
            // encaissée par PaymentProofController quand le caissier acceptera la preuve.
            if (! $needsValidation && $advance !== null && $advance > 0) {
                $this->payments->applyPayment($invoice, $advance, $paymentType ?? 'cash', true, $actorUserId);
            }

            return [
                'contract' => $contract->fresh(),
                'prestation' => $prestation->fresh(),
                'invoice' => $invoice->fresh(),
            ];
        });
    }

    /** Prestation liée à un contrat de package : déjà validée (le contrat existe). */
    public function generatePrestation(SubscriptionPack $package, Contract $contract, ?string $actorUserId): Prestation
    {
        $prestation = Prestation::create([
            'reference' => Prestation::generateReference(),
            'agency_id' => $contract->agency_id,
            'department_id' => $contract->department_id,
            'name' => $package->name,
            'description' => $package->tagline ?? $package->description,
            'client_id' => $contract->client_id,
            'commercial_id' => $contract->commercial_id,
            'package_id' => $package->id,
            'contract_id' => $contract->id,
            'start_date' => $contract->start_date->toDateString(),
            'end_date' => $contract->end_date->toDateString(),
            'budget' => $contract->amount,
            'status' => Prestation::STATUS_VALIDATED,
            'validated_by' => $actorUserId,
            'validated_at' => now(),
            'created_by' => $actorUserId,
        ]);

        foreach ($package->items as $index => $item) {
            PrestationAction::create([
                'prestation_id' => $prestation->id,
                'package_item_id' => $item->id,
                'type' => $item->action_type ?: 'other',
                'title' => $item->label,
                'quantity' => $item->quantity ?: 1,
                'frequency' => $item->frequency ?: 'once',
                'unit' => $item->unit,
                'budget' => 0,
                'status' => PrestationAction::STATUS_TODO,
                'start_date' => $contract->start_date->toDateString(),
                'due_date' => $contract->end_date->toDateString(),
                'sort_order' => $index,
            ]);
        }

        $contract->update(['prestation_id' => $prestation->id]);

        return $prestation;
    }
}
