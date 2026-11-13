<?php

namespace Tests\Concerns;

use App\Models\Category;

/**
 * T8.1 : chaque ligne de facture doit relever d'une catégorie. Les tests qui
 * vendent des lignes libres leur donnent cette catégorie (créée une fois par test).
 */
trait LineCategory
{
    private ?string $lineCategoryId = null;

    protected function lineCategoryId(): string
    {
        if ($this->lineCategoryId === null || ! Category::whereKey($this->lineCategoryId)->exists()) {
            $this->lineCategoryId = Category::factory()->create(['name' => 'Catégorie de test '.uniqid()])->id;
        }

        return $this->lineCategoryId;
    }

    /** Preuve de paiement (PNG 1×1, sans l'extension GD). */
    protected function fakeProof(): \Illuminate\Http\UploadedFile
    {
        return \Illuminate\Http\UploadedFile::fake()->createWithContent('preuve.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        ));
    }
}
