<?php

namespace App\Observers;

use App\Models\Agency;
use App\Observers\Concerns\LogsActivity;

class AgencyObserver
{
    use LogsActivity;

    public function created(Agency $agency): void
    {
        $this->logActivity('agency', 'created', $agency, newValues: $agency->only(['code', 'name']));
    }

    public function updated(Agency $agency): void
    {
        $this->logActivity('agency', 'updated', $agency, $agency->getOriginal(), $agency->getChanges());
    }

    public function deleted(Agency $agency): void
    {
        $this->logActivity('agency', 'deleted', $agency, newValues: $agency->only(['code', 'name']));
    }

    public function restored(Agency $agency): void
    {
        $this->logActivity('agency', 'restored', $agency);
    }

    public function forceDeleted(Agency $agency): void
    {
        $this->logActivity('agency', 'force_deleted', $agency);
    }
}
