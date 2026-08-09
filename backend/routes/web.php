<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'name' => 'PEKEGNO API',
        'version' => app()->version(),
        'status' => 'ok',
    ]);
});
