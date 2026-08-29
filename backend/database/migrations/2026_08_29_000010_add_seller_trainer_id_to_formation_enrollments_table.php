<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un vendeur d'inscription peut être un formateur sans compte utilisateur :
 * on mémorise son profil formateur plutôt qu'un user_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('formation_enrollments', function (Blueprint $table) {
            $table->uuid('seller_trainer_id')->nullable()->after('seller_user_id');
            $table->foreign('seller_trainer_id')->references('id')->on('trainers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('formation_enrollments', function (Blueprint $table) {
            $table->dropForeign(['seller_trainer_id']);
            $table->dropColumn('seller_trainer_id');
        });
    }
};