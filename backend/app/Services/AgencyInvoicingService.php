<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Prestation;
use App\Models\SubscriptionPack;
use App\Models\User;

/**
 * Factures des contrats Agency. Une facture par contrat, payable en N
 * versements (vente ≠ paiement, cahier §11.1). Les lignes de budget
 * publicitaire client sont marquées pass-through (D7/D15).
 */
class AgencyInvoicingService
{
    public function __construct(private readonly InvoiceNumberGenerator $numberGenerator) {}

    /** Facture d'une prestation : honoraires + budget publicitaire (pass-through). */
    public function invoiceForPrestation(
        Contract $contract,
        Prestation $prestation,
        ?string $actorUserId,
        ?string $paymentType = null,
        ?float $declaredAdvance = null,
        bool $needsValidation = false,
    ): Invoice {
        $budget = (float) $prestation->budget;
        $passThrough = min($budget, $prestation->pass_through_budget);
        $fees = round($budget - $passThrough, 2);

        $lines = [];

        if ($fees > 0 || $passThrough <= 0) {
            $lines[] = [
                'prestation_id' => $prestation->id,
                'label' => "Prestation {$prestation->name} ({$prestation->reference})",
                'unit_price' => $fees,
                'quantity' => 1,
                'is_pass_through' => false,
            ];
        }

        if ($passThrough > 0) {
            $lines[] = [
                'prestation_id' => $prestation->id,
                'label' => "Budget publicitaire client — {$prestation->name}",
                'unit_price' => $passThrough,
                'quantity' => 1,
                'is_pass_through' => true,
            ];
        }

        return $this->create(
            $contract,
            $lines,
            $prestation->commercial_id,
            $actorUserId,
            "Contrat {$contract->number} — prestation {$prestation->reference}",
            $paymentType,
            $declaredAdvance,
            $needsValidation,
        );
    }

    /** Facture d'une souscription à un package : prix effectif × nombre de périodes. */
    public function invoiceForPackage(
        Contract $contract,
        SubscriptionPack $package,
        int $periods,
        float $unitPrice,
        ?string $actorUserId,
        ?string $paymentType = null,
        ?float $declaredAdvance = null,
        bool $needsValidation = false,
    ): Invoice {
        return $this->create(
            $contract,
            [[
                'package_id' => $package->id,
                'label' => "Package {$package->name} — {$periods} période(s)",
                'unit_price' => $unitPrice,
                'quantity' => $periods,
                'is_pass_through' => false,
            ]],
            $contract->commercial_id,
            $actorUserId,
            "Contrat {$contract->number} — package {$package->name}",
            $paymentType,
            $declaredAdvance,
            $needsValidation,
        );
    }

    private function create(
        Contract $contract,
        array $lines,
        ?string $commercialId,
        ?string $actorUserId,
        string $comment,
        ?string $paymentType = null,
        ?float $declaredAdvance = null,
        bool $needsValidation = false,
    ): Invoice {
        $client = User::find($contract->client_id);
        $total = round(collect($lines)->sum(fn ($l) => $l['unit_price'] * $l['quantity']), 2);
        $sellerUserId = $commercialId ? Commercial::whereKey($commercialId)->value('user_id') : null;

        $invoice = Invoice::create([
            'number' => $this->numberGenerator->next(),
            'agency_id' => $contract->agency_id,
            'client_id' => $contract->client_id,
            'contract_id' => $contract->id,
            'client_name' => $client ? trim($client->first_name.' '.$client->last_name) : null,
            'commercial_id' => $commercialId,
            'seller_user_id' => $sellerUserId ?? $actorUserId,
            'invoice_date' => now(),
            'payment_type' => $paymentType,
            'total_amount' => $total,
            'amount_paid' => 0,
            // Avance déclarée par le vendeur : encaissée seulement quand un caissier
            // accepte la preuve de paiement (PaymentProofController::markInvoiceValidated).
            'declared_advance' => $declaredAdvance,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            // Souscription faite par un commercial : la facture naît en attente, le
            // caissier la valide après examen de la preuve photo.
            'validation_status' => $needsValidation ? Invoice::VALIDATION_PENDING : Invoice::VALIDATION_VALIDATED,
            'comment' => $comment,
        ]);

        foreach ($lines as $line) {
            $invoice->items()->create($line + [
                'line_total' => round($line['unit_price'] * $line['quantity'], 2),
            ]);
        }

        return $invoice;
    }
}
