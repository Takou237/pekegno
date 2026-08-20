<?php

use App\Jobs\PenalizeInactiveCommercials;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new PenalizeInactiveCommercials)->dailyAt('01:00');
Schedule::command('subscriptions:check-expiry')->dailyAt('06:00');
