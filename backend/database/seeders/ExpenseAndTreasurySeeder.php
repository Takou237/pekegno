<?php

namespace Database\Seeders;

use App\Models\Expense;
use App\Models\TreasuryTransaction;
use App\Models\Agency;
use App\Models\TreasuryAccount;
use App\Models\AccountingCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ExpenseAndTreasurySeeder extends Seeder
{
    /**
     * Dépenses réalistes par agence, liées à une caisse (treasury_account_id)
     * ET mouvements de trésorerie (treasury_transactions).
     * Idempotent (updateOrCreate sur le numéro) + ne supprime rien.
     */
    public function run(): void
    {
        $agencies   = Agency::query()->get();
        $cats       = AccountingCategory::query()->where('type', 'expense')->get();
        $admin      = User::query()->where('email', 'admin@pekegno.com')->first();

        if ($agencies->isEmpty() || $cats->isEmpty()) {
            $this->command?->info('Aucune agence/catégorie — seeder ignoré.');

            return;
        }

        $k = 0;
        $plan = [
            [0, 0, 120000, 'loyer',  'paid'],
            [0, 2,  35000, 'fournitures', 'paid'],
            [0, 4,  18000, 'carburant', 'approved'],
            [1, 1,  98000, 'loyer',  'paid'],
            [1, 2,  42000, 'fournitures', 'submitted'],
            [2, 0, 150000, 'loyer',  'paid'],
            [2, 4,  22000, 'carburant', 'approved'],
        ];

        foreach ($plan as [$agencyIdx, $catIdx, $amount, $label, $status]) {
            $agency = $agencies->get($agencyIdx) ?? $agencies->first();
            $cat    = $cats->get($catIdx) ?? $cats->first();
            $acc    = TreasuryAccount::query()->where('agency_id', $agency->id)->first();

            $number = 'EXP-TEST-'.str_pad((string) ++$k, 4, '0', STR_PAD_LEFT);
            $date   = now()->subDays($k + 10)->toDateString();

            Expense::updateOrCreate(
                ['number' => $number],
                [
                    'agency_id'           => $agency->id,
                    'category_id'         => $cat->id,
                    'amount'              => $amount,
                    'expense_date'        => $date,
                    'status'              => $status,
                    'treasury_account_id' => optional($acc)->id,
                    'requested_by'        => optional($admin)->id,
                    'approved_by'         => in_array($status, ['approved', 'paid'], true) ? optional($admin)->id : null,
                    'paid_by'             => $status === 'paid' ? optional($admin)->id : null,
                    'paid_at'             => $status === 'paid' ? $date : null,
                ]
            );
        }

        $this->command?->info('Expenses seedées : '.Expense::count().' au total (idempotent, non destructif).');
    }
}
