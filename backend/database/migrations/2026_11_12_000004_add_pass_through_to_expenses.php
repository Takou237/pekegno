<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T3.12 — budget publicitaire client (pass-through).
 *
 * Le budget pub facturé au client n'est ni du chiffre d'affaires ni une dépense :
 * il est encaissé pour être dépensé en publicité, seuls les honoraires comptent.
 * Une dépense peut donc être rattachée à la facture qui la finance ; elle est
 * alors marquée `is_pass_through` et sort des dépenses d'exploitation, comme le
 * budget sort du CA. L'écriture comptable correspondante porte le même drapeau
 * pour que toutes les synthèses l'ignorent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->boolean('is_pass_through')->default(false)->after('amount');
            $table->uuid('invoice_id')->nullable()->after('is_pass_through');
            $table->index('invoice_id');
        });

        Schema::table('accounting_transactions', function (Blueprint $table) {
            $table->boolean('is_pass_through')->default(false)->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropIndex(['invoice_id']);
            $table->dropColumn(['is_pass_through', 'invoice_id']);
        });

        Schema::table('accounting_transactions', function (Blueprint $table) {
            $table->dropColumn('is_pass_through');
        });
    }
};
