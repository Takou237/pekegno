<?php

namespace App\Observers\Concerns;

use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Model;

trait LogsActivity
{
    protected function logActivity(string $entityType, string $action, Model $model, ?array $oldValues = null, ?array $newValues = null): void
    {
        $request = request();

        if (! $request) {
            return;
        }

        app(ActivityLogger::class)->log(
            action: $action,
            entityType: $entityType,
            entityId: $model->getKey(),
            description: ucfirst($entityType).' '.$action.' ('.$model->getKey().')',
            oldValues: $oldValues,
            newValues: $newValues,
            request: $request,
        );
    }
}
