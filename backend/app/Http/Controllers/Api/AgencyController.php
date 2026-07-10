<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAgencyRequest;
use App\Http\Requests\Api\UpdateAgencyRequest;
use App\Models\Agency;
use Illuminate\Http\JsonResponse;

class AgencyController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Agency::with('manager', 'departments')->get());
    }

    public function store(StoreAgencyRequest $request): JsonResponse
    {
        $agency = Agency::create($request->validated());
        return response()->json($agency->load('manager', 'departments'), 201);
    }

    public function show(Agency $agency): JsonResponse
    {
        return response()->json($agency->load('manager', 'departments', 'users'));
    }

    public function update(UpdateAgencyRequest $request, Agency $agency): JsonResponse
    {
        $agency->update($request->validated());
        return response()->json($agency->fresh()->load('manager', 'departments'));
    }

    public function destroy(Agency $agency): JsonResponse
    {
        $agency->delete();
        return response()->json(null, 204);
    }
}
