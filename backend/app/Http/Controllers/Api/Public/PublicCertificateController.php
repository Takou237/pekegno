<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use Illuminate\Http\JsonResponse;

/**
 * Vérification publique d'un certificat : aucune authentification, seules les
 * informations nécessaires à la preuve sont exposées (jamais l'email).
 */
class PublicCertificateController extends Controller
{
    public function verify(string $serial): JsonResponse
    {
        $certificate = Certificate::query()
            ->with([
                'enrollment' => fn ($q) => $q->with([
                    'course:id,name',
                    'learner:id,first_name,last_name',
                ]),
            ])
            ->where('number', $serial)
            ->first();

        if (! $certificate) {
            return response()->json([
                'valid' => false,
                'message' => 'Certificat introuvable.',
            ], 404);
        }

        $valid = $certificate->status === Certificate::STATUS_ISSUED;
        $learner = $certificate->enrollment?->learner;

        return response()->json([
            'valid' => $valid,
            'status' => $certificate->status,
            'number' => $certificate->number,
            'issued_on' => $certificate->issued_on?->toDateString(),
            'mention' => $certificate->mention,
            'revoked_reason' => $valid ? null : $certificate->revoked_reason,
            'learner' => trim(($learner?->first_name ?? '').' '.($learner?->last_name ?? '')) ?: null,
            'course' => $certificate->enrollment?->course?->name,
        ]);
    }
}
