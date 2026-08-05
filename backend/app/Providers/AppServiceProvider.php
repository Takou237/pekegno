<?php

namespace App\Providers;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Department;
use App\Models\Service;
use App\Observers\AgencyObserver;
use App\Observers\CategoryObserver;
use App\Observers\DepartmentObserver;
use App\Observers\ServiceObserver;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        JsonResource::withoutWrapping();

        Agency::observe(AgencyObserver::class);
        Department::observe(DepartmentObserver::class);
        Service::observe(ServiceObserver::class);
        Category::observe(CategoryObserver::class);
    }
}
