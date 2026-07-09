<?php

use App\Http\Controllers\Api\Auth\LoginController;
use App\Http\Controllers\Api\Auth\LogoutController;
use App\Http\Controllers\Api\Auth\RegisterController;
use App\Http\Controllers\Api\ProfileController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', LoginController::class);
Route::post('/auth/register', RegisterController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', LogoutController::class);
    Route::get('/user', ProfileController::class);
});
