<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Setting::set('default_commission_type', 'percent', 'Type de commission par défaut (none, percent, fixed)');
        Setting::set('default_commission_value', 20, 'Valeur de commission par défaut');
    }

    public function down(): void
    {
        // On conserve le 20 % par défaut : pas de retour arrière.
    }
};
