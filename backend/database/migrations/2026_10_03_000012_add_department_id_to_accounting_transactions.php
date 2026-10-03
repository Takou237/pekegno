<?php

use App\Models\Invoice;
use App\Services\DepartmentLedger;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Comptabilité et bilan du jour par département : chaque écriture est
 * rattachée au département qui l'a générée (facture de contrat / d'inscription,
 * dépense du département, saisie manuelle depuis le département).
 * Rattrapage des écritures existantes avec les mêmes règles.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounting_transactions', function (Blueprint $table) {
            $table->foreignUuid('department_id')->nullable()->after('agency_id')->constrained('departments')->nullOnDelete();
            $table->index(['department_id', 'transacted_at']);
        });

        $ledger = app(DepartmentLedger::class);

        // Écritures issues de factures.
        DB::table('accounting_transactions')->whereNotNull('invoice_id')->orderBy('id')->chunk(500, function ($rows) use ($ledger) {
            $invoices = Invoice::whereIn('id', $rows->pluck('invoice_id')->unique())->get()->keyBy('id');
            foreach ($rows as $row) {
                $invoice = $invoices->get($row->invoice_id);
                $departmentId = $invoice ? $ledger->departmentForInvoice($invoice) : null;
                if ($departmentId) {
                    DB::table('accounting_transactions')->where('id', $row->id)->update(['department_id' => $departmentId]);
                }
            }
        });

        // Écritures issues de dépenses (référence = numéro de dépense).
        DB::table('expenses')->whereNotNull('department_id')->orderBy('id')->chunk(500, function ($expenses) {
            foreach ($expenses as $expense) {
                DB::table('accounting_transactions')
                    ->where('type', 'expense')
                    ->whereNull('department_id')
                    ->where('reference', $expense->number)
                    ->update(['department_id' => $expense->department_id]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('accounting_transactions', function (Blueprint $table) {
            $table->dropIndex(['department_id', 'transacted_at']);
            $table->dropConstrainedForeignId('department_id');
        });
    }
};
