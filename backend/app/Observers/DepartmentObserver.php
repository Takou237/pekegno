<?php

namespace App\Observers;

use App\Models\Department;
use App\Observers\Concerns\LogsActivity;

class DepartmentObserver
{
    use LogsActivity;

    public function created(Department $department): void
    {
        $this->logActivity('department', 'created', $department, newValues: $department->only(['name']));
    }

    public function updated(Department $department): void
    {
        $this->logActivity('department', 'updated', $department, $department->getOriginal(), $department->getChanges());
    }

    public function deleted(Department $department): void
    {
        $this->logActivity('department', 'deleted', $department, newValues: $department->only(['name']));
    }

    public function restored(Department $department): void
    {
        $this->logActivity('department', 'restored', $department);
    }

    public function forceDeleted(Department $department): void
    {
        $this->logActivity('department', 'force_deleted', $department);
    }
}
