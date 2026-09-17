<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute le pays du client concerné au journal d'audit.
 *
 * La colonne « Pays » de l'audit doit refléter le pays du client (son profil)
 * et non celui de l'agence de la transaction. On dénormalise donc country_id
 * sur activity_logs, comme agency_id. Au passage :
 *  - on aligne users.country_id sur le libellé legacy `country` quand il manque ;
 *  - on renseigne le pays des journaux existants depuis la facture/commande/client.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->foreignUuid('country_id')->nullable()->after('agency_id')
                ->constrained('countries')->nullOnDelete();
        });

        $this->syncUserCountriesFromLegacy();
        $this->backfillLogCountries();
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropForeign(['country_id']);
            $table->dropColumn('country_id');
        });
    }

    private function syncUserCountriesFromLegacy(): void
    {
        DB::table('users')
            ->whereNull('country_id')
            ->whereNotNull('country')
            ->where('country', '<>', '')
            ->orderBy('id')
            ->chunkById(500, function ($users) {
                $names = $users->pluck('country')->unique()->filter()->values()->all();
                $countries = DB::table('countries')->whereIn('name', $names)->pluck('id', 'name');

                foreach ($users as $user) {
                    $countryId = $countries[$user->country] ?? null;

                    if ($countryId) {
                        DB::table('users')->where('id', $user->id)->update(['country_id' => $countryId]);
                    }
                }
            });
    }

    private function backfillLogCountries(): void
    {
        DB::table('activity_logs')
            ->whereNull('country_id')
            ->orderBy('id')
            ->chunkById(500, function ($logs) {
                $invoiceIds = $logs->where('entity_type', 'invoice')->pluck('entity_id')->filter()->unique()->values()->all();
                $orderIds = $logs->where('entity_type', 'order')->pluck('entity_id')->filter()->unique()->values()->all();

                $invoiceClients = $invoiceIds
                    ? DB::table('invoices')->whereIn('id', $invoiceIds)->pluck('client_id', 'id')
                    : collect();
                $orderClients = $orderIds
                    ? DB::table('orders')->whereIn('id', $orderIds)->pluck('client_id', 'id')
                    : collect();

                $clientIds = [];
                foreach ($logs as $log) {
                    $clientId = $this->clientIdFor($log, $invoiceClients, $orderClients);
                    if ($clientId) {
                        $clientIds[] = $clientId;
                    }
                }

                $userIds = array_values(array_unique(array_merge(
                    $clientIds,
                    $logs->pluck('user_id')->filter()->all(),
                )));

                $userCountries = $userIds
                    ? DB::table('users')->whereIn('id', $userIds)->pluck('country_id', 'id')
                    : collect();

                foreach ($logs as $log) {
                    $clientId = $this->clientIdFor($log, $invoiceClients, $orderClients);

                    $countryId = ($clientId ? ($userCountries[$clientId] ?? null) : null)
                        ?? ($log->user_id ? ($userCountries[$log->user_id] ?? null) : null);

                    if ($countryId) {
                        DB::table('activity_logs')->where('id', $log->id)->update(['country_id' => $countryId]);
                    }
                }
            });
    }

    private function clientIdFor(object $log, $invoiceClients, $orderClients): ?string
    {
        return match ($log->entity_type) {
            'invoice' => $invoiceClients[$log->entity_id] ?? null,
            'order' => $orderClients[$log->entity_id] ?? null,
            'client' => $log->entity_id,
            default => null,
        };
    }
};
