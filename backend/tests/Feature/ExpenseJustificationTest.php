<?php

namespace Tests\Feature;

use App\Models\AccountingCategory;
use App\Models\Agency;
use App\Models\Expense;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Dépenses (CdC §14) : photo du justificatif jointe à la dépense. */
class ExpenseJustificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_receipt_photo_is_attached_to_the_expense(): void
    {
        Storage::fake('public');
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $agency = Agency::factory()->create();
        $category = AccountingCategory::create(['name' => 'Fournitures', 'type' => 'expense']);
        $admin = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
        $expense = Expense::create([
            'requested_by' => $admin->id,
            'number' => 'DEP-0001', 'agency_id' => $agency->id, 'category_id' => $category->id,
            'amount' => 15000, 'expense_date' => '2026-11-13', 'status' => Expense::STATUS_DRAFT,
        ]);

        Sanctum::actingAs($admin);
        $png = UploadedFile::fake()->createWithContent('recu.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='));
        $data = $this->post("/api/expenses/{$expense->id}/justification", ['file' => $png], ['Accept' => 'application/json'])->assertOk()->json();

        $this->assertNotNull($data['justification_url']);
        Storage::disk('public')->assertExists($expense->fresh()->justification_path);

        // Un fichier qui n'est ni une image ni un PDF est refusé.
        $this->post("/api/expenses/{$expense->id}/justification", ['file' => UploadedFile::fake()->create('virus.exe', 10)], ['Accept' => 'application/json'])->assertStatus(422);
    }
}
