<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\Prestation;
use App\Models\PrestationActionReview;
use App\Services\AgencyAccessService;
use App\Services\PrestationReviewService;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Notes 5★ — lecture seule côté staff (D5 : seul le client note). */
class PrestationReviewController extends Controller
{
    public function __construct(
        private readonly PrestationReviewService $reviews,
        private readonly AgencyAccessService $access,
        private readonly ScopeService $scope,
    ) {}

    public function index(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        $reviews = PrestationActionReview::where('prestation_id', $prestation->id)
            ->with('action:id,title,type', 'client:id,first_name,last_name')
            ->latest('updated_at')
            ->get();

        return response()->json([
            'data' => $reviews,
            'summary' => $this->reviews->summaryForPrestation($prestation),
        ]);
    }

    public function summary(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        return response()->json($this->reviews->summaryForPrestation($prestation));
    }

    public function aggregate(Request $request): JsonResponse
    {
        $filters = $request->only(['package_id', 'category_id', 'commercial_id', 'department_id', 'agency_id', 'user_id']);

        return response()->json($this->reviews->aggregate($filters, $this->scope->agencyIds($request->user())));
    }
}
