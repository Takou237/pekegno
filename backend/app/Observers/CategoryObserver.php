<?php

namespace App\Observers;

use App\Models\Category;
use App\Observers\Concerns\LogsActivity;

class CategoryObserver
{
    use LogsActivity;

    public function created(Category $category): void
    {
        $this->logActivity('category', 'created', $category, newValues: $category->only(['name']));
    }

    public function updated(Category $category): void
    {
        $this->logActivity('category', 'updated', $category, $category->getOriginal(), $category->getChanges());
    }

    public function deleted(Category $category): void
    {
        $this->logActivity('category', 'deleted', $category, newValues: $category->only(['name']));
    }

    public function restored(Category $category): void
    {
        $this->logActivity('category', 'restored', $category);
    }

    public function forceDeleted(Category $category): void
    {
        $this->logActivity('category', 'force_deleted', $category);
    }
}
