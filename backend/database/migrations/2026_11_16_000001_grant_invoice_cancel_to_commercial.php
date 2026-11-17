<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Le commercial peut annuler sa propre facture tant qu'elle n'est pas
     * encaissée (contrôle de propriété et de montant dans InvoiceController::cancel).
     * La route /invoices/{invoice}/cancel est protégée par `invoices.annuler`,
     * droit qui n'était accordé qu'à l'encadrement : le commercial recevait un
     * 403 malgré le bouton visible. Rejouable.
     */
    public function up(): void
    {
        $roleId = DB::table('roles')->where('name', 'commercial')->value('id');
        if (! $roleId) {
            return;
        }

        $permissionId = DB::table('permissions')->where('name', 'invoices.annuler')->value('id');
        if (! $permissionId) {
            return;
        }

        DB::table('role_permission')->insertOrIgnore([
            'role_id' => $roleId,
            'permission_id' => $permissionId,
        ]);
    }

    public function down(): void
    {
        // Pas de retrait : le droit reste nécessaire au parcours commercial.
    }
};
