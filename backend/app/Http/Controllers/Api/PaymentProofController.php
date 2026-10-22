<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\InvoiceStatusMail;
use App\Models\Agency;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ContractService;
use App\Services\InvoiceRejectionNotifier;
use App\Services\PaymentService;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * Examen des preuves de paiement par le personnel (caissier / direction).
 * Permet au caissier de vérifier une preuve soumise par un client (ou un
 * commercial pour un paiement numérique) avant de valider et encaisser.
 */
class PaymentProofController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $logger,
        private readonly PaymentService $paymentService,
        private readonly InvoiceRejectionNotifier $rejections,
        private readonly ContractService $contracts,
    ) {}

    #[OA\Get(
        path: '/api/payment-proofs',
        summary: 'Lister les preuves de paiement avec filtres',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['pending', 'accepted', 'rejected'])),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'country_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des preuves'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        // Une preuve n'est examinable que par qui peut valider sa facture : le
        // périmètre des preuves suit donc exactement celui des factures
        // (InvoiceController::scopeByRole). Sans l'élargissement au pays, une
        // facture en attente d'un commercial d'une autre agence était bien
        // listée, mais sa preuve restait filtrée ici — le caissier arrivait sur
        // « Valider » et se trouvait devant « aucune preuve à afficher ».
        $pendingCountryIds = $agencyIds === null
            ? collect()
            : Agency::whereIn('id', $agencyIds)
                ->whereNotNull('country_id')
                ->pluck('country_id')
                ->unique()
                ->values();

        $query = PaymentProof::query()
            ->with(['invoice:id,number,client_name,total_amount,validation_status,status,agency_id', 'submitter:id,first_name,last_name,email', 'reviewer:id,first_name,last_name,email'])
            ->when($request->filled('invoice_id'), fn ($q) => $q->where('invoice_id', $request->input('invoice_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->input('status')))
            ->when($request->filled('agency_id'), fn ($q) => $q->whereHas('invoice', fn ($inner) => $inner->where('agency_id', $request->input('agency_id'))))
            ->when($request->filled('country_id'), fn ($q) => $q->whereHas('invoice.agency', fn ($inner) => $inner->where('country_id', $request->input('country_id'))))
            ->when($agencyIds !== null, fn ($q) => $q->where(function ($q) use ($agencyIds, $pendingCountryIds) {
                $q->whereHas('invoice', fn ($inner) => $inner->whereIn('agency_id', $agencyIds))
                    ->orWhereHas('invoice', fn ($inner) => $inner->whereNull('agency_id'))
                    ->when($pendingCountryIds->isNotEmpty(), fn ($q) => $q->orWhereHas('invoice', fn ($inner) => $inner
                        ->where('validation_status', Invoice::VALIDATION_PENDING)
                        ->whereHas('agency', fn ($a) => $a->whereIn('country_id', $pendingCountryIds))));
            }))
            ->orderByDesc('created_at');

        return response()->json($query->paginate(min((int) $request->input('per_page', 15), 100)));
    }

    #[OA\Post(
        path: '/api/invoices/{invoice}/payment-proof',
        summary: 'Soumettre une preuve de paiement pour une facture (staff)',
        description: 'Permet au commercial (ou tout membre du personnel habilité) de joindre une preuve de paiement à une facture, exactement comme un client. La preuve reste en attente d\'examen par le caissier.',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 201, description: 'Preuve créée'),
            new OA\Response(response: 404, description: 'Facture introuvable'),
            new OA\Response(response: 422, description: 'Facture déjà validée ou rejetée / fichier invalide'),
        ]
    )]
    public function uploadStaffProof(Request $request, Invoice $invoice): JsonResponse
    {
        abort_if($invoice->validation_status === Invoice::VALIDATION_VALIDATED, 422, 'Cette facture est déjà validée.');
        abort_if($invoice->validation_status === Invoice::VALIDATION_REJECTED, 422, 'Cette facture a été rejetée : elle ne peut plus recevoir de preuve de paiement.');

        $data = $request->validate([
            'file' => ['required', 'file', 'image', 'mimes:jpeg,png,gif,webp', 'max:5120'],
            'payment_method' => ['required', 'string', 'max:30'],
            'phone_number_used' => ['nullable', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:100'],
        ]);

        $path = $request->file('file')->store('payment-proofs', 'public');

        $proof = PaymentProof::create([
            'invoice_id' => $invoice->id,
            'submitted_by' => $request->user()->id,
            'payment_method' => $data['payment_method'],
            'phone_number_used' => $data['phone_number_used'] ?? null,
            'reference' => $data['reference'] ?? null,
            'file_path' => $path,
            'status' => 'pending',
        ]);

        $this->logger->log(
            action: 'proof_submitted',
            entityType: 'invoice',
            entityId: $invoice->id,
            description: "Preuve de paiement (staff, {$data['payment_method']}) soumise pour la facture {$invoice->number}",
            newValues: ['payment_proof' => $proof->id, 'method' => $data['payment_method']],
            request: $request,
        );

        return response()->json([
            'payment_proof' => $proof,
            'url' => Storage::disk('public')->url($path),
        ], 201);
    }

    #[OA\Post(
        path: '/api/invoices/{invoice}/pay-remaining',
        summary: 'Régler le reste à payer d\'une facture partielle avec preuve (staff)',
        description: 'Le commercial (ou le vendeur) transmet le montant restant, le mode de paiement et une preuve. La preuve reste en attente : à son acceptation par le caissier, le montant est encaissé automatiquement et un reçu est généré.',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 201, description: 'Preuve de règlement créée, en attente de validation'),
            new OA\Response(response: 422, description: 'Facture non validée / déjà soldée / montant invalide'),
        ]
    )]
    public function payRemaining(Request $request, Invoice $invoice): JsonResponse
    {
        abort_if($invoice->is_cancelled, 422, 'Impossible de régler une facture annulée.');
        abort_if(
            $invoice->validation_status !== Invoice::VALIDATION_VALIDATED,
            422,
            "La facture doit d'abord être validée par un caissier avant de régler le reste."
        );
        abort_if($invoice->status === 'paid', 422, 'Cette facture est déjà soldée.');

        // Un commercial ne règle que ses propres ventes (il ne peut pas agir sur
        // la facture d'un collègue en saisissant un id arbitraire).
        $this->ensureCanSubmitFor($invoice, $request->user());

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'in:cash,om,momo,mobile'],
            'phone_number_used' => ['nullable', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:100'],
            'file' => ['required', 'file', 'image', 'mimes:jpeg,png,gif,webp', 'max:5120'],
        ]);

        $amount = round((float) $data['amount'], 2);

        if ($amount > (float) $invoice->balance_due) {
            throw ValidationException::withMessages([
                'amount' => "Le montant dépasse le reste à payer ({$invoice->balance_due} FCFA).",
            ]);
        }

        // Une seule preuve de règlement en attente à la fois : sinon le caissier
        // pourrait encaisser deux fois le même reste.
        $alreadyPending = $invoice->paymentProofs()
            ->where('status', PaymentProof::STATUS_PENDING)
            ->whereNotNull('amount')
            ->exists();

        if ($alreadyPending) {
            throw ValidationException::withMessages([
                'amount' => 'Un règlement du reste à payer est déjà en attente de validation.',
            ]);
        }

        $path = $request->file('file')->store('payment-proofs', 'public');

        $proof = PaymentProof::create([
            'invoice_id' => $invoice->id,
            'submitted_by' => $request->user()->id,
            'payment_method' => $data['payment_method'],
            'phone_number_used' => $data['phone_number_used'] ?? null,
            'reference' => $data['reference'] ?? null,
            'amount' => $amount,
            'file_path' => $path,
            'status' => PaymentProof::STATUS_PENDING,
        ]);

        $this->logger->log(
            action: 'proof_submitted',
            entityType: 'invoice',
            entityId: $invoice->id,
            description: sprintf(
                'Règlement du reste à payer : %s FCFA (%s) soumis pour la facture %s',
                number_format($amount, 0, ',', ' '),
                $data['payment_method'],
                $invoice->number,
            ),
            newValues: ['payment_proof' => $proof->id, 'amount' => $amount, 'method' => $data['payment_method']],
            request: $request,
            agencyId: $invoice->agency_id,
        );

        return response()->json([
            'payment_proof' => $proof,
            'url' => Storage::disk('public')->url($path),
        ], 201);
    }

    /**
     * Un commercial ne peut soumettre un règlement que pour ses propres factures
     * (commercial_id) ou celles dont il est le vendeur ; les autres profils
     * habilités (caissier, direction, admin) n'ont pas cette restriction.
     */
    private function ensureCanSubmitFor(Invoice $invoice, ?User $user): void
    {
        if (! $user || $user->role?->name !== 'commercial') {
            return;
        }

        $profileId = $user->commercialProfile?->id;

        abort_unless(
            $profileId && ($invoice->commercial_id === $profileId || $invoice->seller_user_id === $user->id),
            403,
            'Vous ne pouvez régler que vos propres factures.'
        );
    }

    #[OA\Post(
        path: '/api/payment-proofs/{proof}/approve',
        summary: 'Accepter une preuve de paiement',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'proof', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Preuve acceptée'),
            new OA\Response(response: 422, description: 'Preuve déjà traitée'),
        ]
    )]
    public function approve(Request $request, PaymentProof $proof): JsonResponse
    {
        abort_unless(
            in_array($request->user()?->role?->name, ['super-admin', 'direction-generale', 'caissier'], true),
            403,
            'Seuls les administrateurs et les caissiers peuvent accepter une preuve de paiement.'
        );

        return $this->review($request, $proof, PaymentProof::STATUS_ACCEPTED);
    }

    #[OA\Post(
        path: '/api/payment-proofs/{proof}/reject',
        summary: 'Rejeter une preuve de paiement (motif obligatoire)',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'proof', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['notes'],
                properties: [
                    new OA\Property(property: 'notes', type: 'string', description: 'Motif du rejet de la preuve'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Preuve rejetée'),
            new OA\Response(response: 422, description: 'Preuve déjà traitée ou motif manquant'),
        ]
    )]
    public function reject(Request $request, PaymentProof $proof): JsonResponse
    {
        $request->validate(['notes' => ['required', 'string']]);

        return $this->review($request, $proof, PaymentProof::STATUS_REJECTED);
    }

    private function review(Request $request, PaymentProof $proof, string $status): JsonResponse
    {
        abort_if($proof->status !== PaymentProof::STATUS_PENDING, 422, 'Cette preuve a déjà été traitée.');

        DB::transaction(function () use ($request, $proof, $status) {
            $proof->update([
                'status' => $status,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'notes' => $status === PaymentProof::STATUS_REJECTED ? trim((string) $request->input('notes', '')) : null,
            ]);

            // Chaînage du workflow : accepter la preuve valide automatiquement la
            // facture, la rejeter la rejette automatiquement. Cela évite les états
            // incohérents (preuve acceptée mais facture rejetée, ou l'inverse).
            $invoice = Invoice::find($proof->invoice_id);

            if ($invoice && $invoice->validation_status === Invoice::VALIDATION_PENDING) {
                if ($status === PaymentProof::STATUS_ACCEPTED) {
                    $this->markInvoiceValidated($invoice, $request->user()->id);
                } else {
                    $reason = 'Preuve de paiement rejetée : '.trim((string) $request->input('notes', ''));
                    $this->markInvoiceRejected($invoice, $request->user()->id, $reason);
                }
            } elseif (
                $invoice
                && $status === PaymentProof::STATUS_ACCEPTED
                && $invoice->validation_status === Invoice::VALIDATION_VALIDATED
                && ! $invoice->is_cancelled
                && (float) ($proof->amount ?? 0) > 0
            ) {
                // Facture déjà validée (vente partielle) : la preuve porte le
                // montant du reste à payer. L'accepter encaisse automatiquement
                // ce montant — reçu, trésorerie, comptabilité et commissions.
                $this->applyRemainingPayment($invoice, $proof, $request->user()->id);
            }

            $this->logger->log(
                action: $status === PaymentProof::STATUS_ACCEPTED ? 'proof_accepted' : 'proof_rejected',
                entityType: 'invoice',
                entityId: $proof->invoice_id,
                description: sprintf(
                    'Preuve de paiement (%s) %s pour la facture %s',
                    $proof->payment_method,
                    $status === PaymentProof::STATUS_ACCEPTED ? 'acceptée' : 'rejetée',
                    $invoice?->number ?? $proof->invoice_id,
                ),
                newValues: ['proof' => $proof->id, 'status' => $status],
                request: $request,
            );
        });

        $invoice = Invoice::with([
            'items',
            'payments',
            'commissionPayments',
            'client',
            'commercial',
            'agency',
            'seller',
            'paymentProofs' => fn ($q) => $q->with(['submitter:id,first_name,last_name,email', 'reviewer:id,first_name,last_name,email']),
        ])->find($proof->invoice_id);

        return response()->json([
            'proof' => $proof->fresh(),
            'invoice' => $invoice,
        ]);
    }

    private function markInvoiceValidated(Invoice $invoice, string $userId): void
    {
        $invoice->update([
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'validated_by' => $userId,
            'validated_at' => now(),
            'rejection_reason' => null,
        ]);

        // L'avance annoncée par le commercial à la création n'a pas été encaissée
        // (il ne peut pas manier de caisse) : elle est appliquée maintenant, au
        // moment où un caissier / la direction valide la facture via la preuve.
        if ((float) ($invoice->declared_advance ?? 0) > 0 && (float) $invoice->amount_paid === 0.0) {
            $this->paymentService->applyPayment(
                $invoice,
                (float) $invoice->declared_advance,
                $invoice->payment_type ?? 'cash',
                true,
                $userId,
            );
        } elseif ($invoice->source === 'client_self' && (float) $invoice->amount_paid === 0.0) {
            // Une commande passée en ligne par le client est réglée intégralement (pas
            // d'avance possible sur ce canal) : accepter la preuve de paiement encaisse
            // donc directement le montant total, et la facture passe en statut "payé".
            $proof = $invoice->paymentProofs()->where('status', PaymentProof::STATUS_ACCEPTED)->latest('reviewed_at')->first();

            $this->paymentService->applyPayment(
                $invoice,
                (float) $invoice->total_amount,
                $proof?->payment_method ?? $invoice->payment_type ?? 'cash',
                false,
                $userId,
            );
        }

        $this->logger->log('validated', 'invoice', $invoice->id, "Facture {$invoice->number} validée (preuve de paiement acceptée)");

        $this->sendStatusNotification($invoice);
    }

    /**
     * Encaisse le montant d'une preuve de règlement acceptée sur une facture déjà
     * validée : crée le versement (avec son numéro de reçu), alimente la trésorerie
     * et la comptabilité, et calcule commissions / points. Le reçu est visible du
     * caissier comme du commercial (historique des versements de la facture).
     */
    private function applyRemainingPayment(Invoice $invoice, PaymentProof $proof, string $userId): void
    {
        $balance = (float) $invoice->balance_due;

        if ($balance <= 0) {
            return;
        }

        // On plafonne au reste à payer : une preuve acceptée ne peut jamais faire
        // dépasser le total de la facture.
        $amount = min(round((float) $proof->amount, 2), $balance);

        if ($amount <= 0) {
            return;
        }

        $this->paymentService->applyPayment(
            invoice: $invoice,
            amount: $amount,
            method: $proof->payment_method ?: 'cash',
            isAdvance: false,
            userId: $userId,
        );

        $this->logger->log(
            action: 'paid',
            entityType: 'invoice',
            entityId: $invoice->id,
            description: sprintf(
                'Règlement de %s FCFA (%s) encaissé sur la facture %s (preuve acceptée)',
                number_format($amount, 0, ',', ' '),
                $proof->payment_method,
                $invoice->number,
            ),
            newValues: ['payment_proof' => $proof->id, 'amount' => $amount],
            agencyId: $invoice->agency_id,
        );

        $this->sendStatusNotification($invoice);
    }

    private function markInvoiceRejected(Invoice $invoice, string $userId, string $reason): void
    {
        $invoice->update([
            'validation_status' => Invoice::VALIDATION_REJECTED,
            'validated_by' => $userId,
            'validated_at' => now(),
            'rejection_reason' => $reason,
        ]);

        $this->logger->log('rejected', 'invoice', $invoice->id, "Facture {$invoice->number} rejetée : {$reason}");

        $this->rejections->notify($invoice, $reason);

        // Une souscription dont la facture est rejetée avant activation est
        // abandonnée : le contrat en attente est résilié pour permettre au client
        // de souscrire de nouveau au package.
        $this->contracts->cancelPendingForInvoice($invoice, "Facture {$invoice->number} rejetée");
    }

    private function sendStatusNotification(Invoice $invoice): void
    {
        $email = $invoice->client?->email;

        if (! $email) {
            return;
        }

        $frontend = rtrim((string) env('FRONTEND_URL', ''), '/');

        // Un SMTP en panne ne doit pas faire échouer la validation / le rejet,
        // déjà enregistré en base à ce stade.
        try {
            Mail::to($email)->send(new InvoiceStatusMail(
                invoice: $invoice,
                clientUrl: $frontend !== '' ? "{$frontend}/mon-compte/factures" : null,
            ));
        } catch (\Throwable $e) {
            Log::error("Échec de l'envoi de l'email de statut de la facture {$invoice->number} : ".$e->getMessage());
        }
    }
}
