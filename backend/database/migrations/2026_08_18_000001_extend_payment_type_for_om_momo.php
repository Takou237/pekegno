<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_type_check");
        DB::statement("ALTER TABLE invoices ALTER COLUMN payment_type TYPE varchar(20)");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE invoices ALTER COLUMN payment_type TYPE varchar(20)");
    }
};
