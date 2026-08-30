<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\CommissionEntry;
use App\Models\CommissionPayment;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $legacy = CommissionPayment::query()
                ->whereNotNull('payment_id')
                ->whereNotNull('commercial_id')
                ->get();

            foreach ($legacy as $row) {
                $exists = CommissionEntry::query()
                    ->where('invoice_payment_id', $row->payment_id)
                    ->whereNull('commission_rule_id')
                    ->where('beneficiary_commercial_id', $row->commercial_id)
                    ->where('base_amount', $row->base_amount ?? $row->amount)
                    ->where('product_id', $row->service_id)
                    ->exists();

                if ($exists) {
                    continue;
                }

                CommissionEntry::create([
                    'invoice_id' => $row->invoice_id,
                    'invoice_payment_id' => $row->payment_id,
                    'commission_rule_id' => null,
                    'rule_snapshot' => null,
                    'beneficiary_commercial_id' => $row->commercial_id,
                    'seller_profile_id' => null,
                    'base_amount' => $row->base_amount ?? $row->amount,
                    'amount' => $row->amount,
                    'category' => 'service',
                    'product_id' => $row->service_id,
                    'product_type' => $row->service_id ? 'service' : null,
                    'status' => CommissionEntry::STATUS_CALCULATED,
                ]);
            }
        });
    }

    public function down(): void
    {
        DB::table('commission_entries')
            ->whereNull('commission_rule_id')
            ->whereNotNull('invoice_payment_id')
            ->whereNull('seller_profile_id')
            ->delete();
    }
};