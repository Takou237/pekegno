<?php

namespace App\Observers;

use App\Models\Service;
use App\Observers\Concerns\LogsActivity;

class ServiceObserver
{
    use LogsActivity;

    public function created(Service $service): void
    {
        $this->logActivity('service', 'created', $service, newValues: $service->only(['name', 'price']));
    }

    public function updated(Service $service): void
    {
        $this->logActivity('service', 'updated', $service, $service->getOriginal(), $service->getChanges());
    }

    public function deleted(Service $service): void
    {
        $this->logActivity('service', 'deleted', $service, newValues: $service->only(['name', 'price']));
    }

    public function restored(Service $service): void
    {
        $this->logActivity('service', 'restored', $service);
    }

    public function forceDeleted(Service $service): void
    {
        $this->logActivity('service', 'force_deleted', $service);
    }
}
