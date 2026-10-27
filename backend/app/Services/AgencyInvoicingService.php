<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Prestation;
use App\Models\SubscriptionPack;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Factures des contrats Agency. Une facture par contrat, payable en N
 * versements (vente à paiement, cahier n°11.1). Les lignes de budget
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
        ?string $discountType = null,
        ?float $discountValue = null,
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
                'label' => "Budget publicitaire client – {$prestation->name}",
                'unit_price' => $passThrough,
                'quantity' => 1,
                'is_pass_through' => true,
            ];
        }

        $comment = "Contrat {$contract->number} – prestation {$prestation->reference}";
        $discountAmount = $this->resolveDiscount($lines, $discountType, $discountValue, $comment);

        return $this->create(
            $contract,
            $lines,
            $prestation->commercial_id,
            $actorUserId,
            $comment,
            $paymentType,
            $declaredAdvance,
            $needsValidation,
            $discountAmount,
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
        ?string $discountType = null,
        ?float $discountValue = null,
    ): Invoice {
        $lines = [[
            'package_id' => $package->id,
            'label' => "Package {$package->name} – {$periods} période(s)",
            'unit_price' => $unitPrice,
            'quantity' => $periods,
            'is_pass_through' => false,
        ]];

        $comment = "Contrat {$contract->number} – package {$package->name}";
        $discountAmount = $this->resolveDiscount($lines, $discountType, $discountValue, $comment);

        return $this->create(
            $contract,
            $lines,
            $contract->commercial_id,
            $actorUserId,
            $comment,
            $paymentType,
            $declaredAdvance,
            $needsValidation,
            $discountAmount,
        );
    }

    private function resolveDiscount(array $lines, ?string $discountType, ?float $discountValue, string &$comment): float
    {
        if ($discountType === null || $discountValue === null || $discountValue <= 0) {
            return 0.0;
        }

        $subtotal = round(collect($lines)->sum(fn ($l) => (float) $l['unit_price'] * (int) ($l['quantity'] ?? 1)), 2);
        $discountValue = round((float) $discountValue, 2);

        if ($discountType === 'percent') {
            if ($discountValue > 100) {
                throw ValidationException::withMessages([
                    'discount_value' => 'Le pourcentage de remise doit être inférieur ou égal à 100.',
                ]);
            }
            $discountAmount = round($subtotal * ($discountValue / 100), 2);
        } elseif ($discountType === 'amount') {
            if ($discountValue > $subtotal) {
                throw ValidationException::withMessages([
                    'discount_value' => 'La remise ne peut pas dépasser le montant total.',
                ]);
            }
            $discountAmount = $discountValue;
        } else {
            throw ValidationException::withMessages([
                'discount_type' => 'Type de remise invalide (amount ou percent).',
            ]);
        }

        if ($discountAmount > 0) {
            $comment .= ' – Remise : '.number_format($discountAmount, 0, ',', ' ');
        }

        return round(max(0, $discountAmount), 2);
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
        float $discountAmount = 0.0,
    ): Invoice {
        $client = User::find($contract->client_id);
        $subtotal = round(collect($lines)->sum(fn ($l) => (float) $l['unit_price'] * (int) ($l['quantity'] ?? 1)), 2);
        $total = round(max(0, $subtotal - $discountAmount), 2);
        $sellerUserId = $commercialId ? Commercial::whereKey($commercialId)->value('user_id') : null;

        if ($declaredAdvance !== null && $declaredAdvance > $total) {
            $declaredAdvance = $total;
        }

        $invoice = Invoice::create([
            'number' => $this->numberGenerator->next(),
            'agency_id' => $contract->agency_id,
            'client_id' => $contract->client_id,
            'contract_id' => $contract->id,
            'client_name' => $client ? trim($client->first_name.' '.$client->last_name) : null,
            'commercial_id' => $commercialId,
            'seller_user_id' => $sellerUserId ?? $actorUserId,
            'created_by' => $actorUserId,
            'invoice_date' => now(),
            'payment_type' => $paymentType,
            'total_amount' => $total,
            'amount_paid' => 0,
            // Avance déclarée par le vendeur : encaissée seulement quand un caissier
            // accepte la preuve de paiement (PaymentProofController::markInvoiceValidated).
            'declared_advance' => $declaredAdvance,
            'discount' => $discountAmount,
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
