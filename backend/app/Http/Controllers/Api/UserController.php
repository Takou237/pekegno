<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreUserRequest;
use App\Http\Requests\Api\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Mail\AdminPasswordResetMail;
use App\Mail\UserWelcomeMail;
use App\Models\Department;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\CommercialProfileService;
use App\Services\WelcomeEmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

class UserController extends Controller
{
    private const ALLOWED_WITH = ['role', 'assignments'];

    /**
     * Mot de passe attribué quand l'administrateur n'en fournit pas.
     * Il est transmis au nouvel utilisateur par email (UserWelcomeMail).
     */
    private const DEFAULT_PASSWORD = 'password';

    public function __construct(
        private readonly ActivityLogger $logger,
        private readonly WelcomeEmailService $welcomeEmailService,
        private readonly CommercialProfileService $commercialProfileService,
    ) {}

    private function parseWith(Request $request): array
    {
        $with = $request->input('with');
        if (! $with) {
            return [];
        }
        $relations = array_map('trim', explode(',', $with));

        return array_intersect($relations, self::ALLOWED_WITH);
    }

    #[OA\Get(
        path: '/api/users/username-suggestion',
        summary: 'Proposer un nom d\'utilisateur libre à partir du prénom et du nom',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'first_name', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'last_name', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Nom d\'utilisateur proposé'),
        ]
    )]
    public function suggestUsername(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()?->role?->name, ['super-admin', 'direction-generale', 'responsable-agence'], true), 403);

        $data = $request->validate([
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
        ]);

        // « Jean-Marc Élé » + « N'Diaye » → « jeanmarc.ele.ndiaye » puis suffixe
        // numérique tant que le nom est déjà pris.
        $slug = fn (?string $v) => Str::of((string) $v)->ascii()->lower()->replaceMatches('/[^a-z0-9]+/', '')->toString();
        $parts = array_filter([$slug($data['first_name'] ?? null), $slug($data['last_name'] ?? null)]);
        $base = Str::limit(implode('.', $parts), 90, '');

        if ($base === '') {
            return response()->json(['username' => null]);
        }

        $candidate = $base;
        for ($i = 2; User::where('username', $candidate)->exists(); $i++) {
            $candidate = $base.$i;
        }

        return response()->json(['username' => $candidate]);
    }

    #[OA\Get(
        path: '/api/users',
        summary: 'Lister les utilisateurs (admin)',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom/email/username', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'is_active', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort', in: 'query', schema: new OA\Schema(type: 'string', default: 'created_at')),
            new OA\Parameter(name: 'order', in: 'query', schema: new OA\Schema(type: 'string', default: 'desc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des utilisateurs'),
        ]
    )]
    public function index(Request $request)
    {
        $defaultWith = ['role', 'assignments'];
        $with = array_unique(array_merge($defaultWith, $this->parseWith($request)));

        $user = $request->user();
        $users = User::with($with)
            ->whereHas('role', fn ($q) => $q->where('name', '!=', 'client'))
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%");
                });
            })
            ->when($request->is_active !== null, function ($q) use ($request) {
                $q->where('is_active', $request->boolean('is_active'));
            })
            ->when($request->role, function ($q, $roleName) {
                $q->whereHas('role', fn ($rq) => $rq->where('name', $roleName));
            })
            ->when($request->agency_id, function ($q, $agencyId) {
                $q->whereHas('assignments', fn ($q) => $q->where('agency_id', $agencyId));
            })
            ->when($request->department_id, function ($q, $departmentId) {
                $q->whereHas('assignments', fn ($q) => $q->where('department_id', $departmentId));
            })
            ->when($user?->role?->name === 'responsable-agence', function ($q) use ($user) {
                $agencyIds = DB::table('user_assignments')
                    ->where('user_id', $user->id)
                    ->where('is_primary', true)
                    ->pluck('agency_id');
                $q->whereHas('assignments', fn ($q) => $q->whereIn('agency_id', $agencyIds));
            })
            ->when($user?->role?->name === 'responsable-departement', function ($q) use ($user) {
                $deptIds = DB::table('department_chiefs')
                    ->where('user_id', $user->id)
                    ->pluck('department_id');
                $q->whereHas('assignments', fn ($q) => $q->whereIn('department_id', $deptIds));
            })
            ->orderBy($request->sort ?? 'created_at', $request->order ?? 'desc')
            ->paginate($request->per_page ?? 15);

        return UserResource::collection($users);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Le mot de passe est conservé en clair pour être transmis par email :
        // l'administrateur ne le saisit pas dans le formulaire de création.
        $plainPassword = (string) ($data['password'] ?? self::DEFAULT_PASSWORD);
        $data['password'] = Hash::make($plainPassword);

        $creator = $request->user();

        $user = DB::transaction(function () use ($data, $creator) {
            $user = User::create($data);

            // Un responsable d'agence ne peut créer que des employés de ses agences :
            // on rattache automatiquement le nouvel employé à son agence primaire.
            if ($creator?->role?->name === 'responsable-agence') {
                $agencyId = DB::table('user_assignments')
                    ->where('user_id', $creator->id)
                    ->where('is_primary', true)
                    ->value('agency_id');

                if ($agencyId) {
                    $user->assignments()->attach($agencyId, [
                        'is_primary' => false,
                        'is_department_chief' => false,
                        'department_id' => null,
                    ]);
                }

                return $user;
            }

            // Super-admin / direction-générale : rattachement optionnel à une
            // agence et/ou un département fournis lors de la création.
            $agencyId = $data['agency_id'] ?? null;
            $departmentId = $data['department_id'] ?? null;

            // Si seul le département est renseigné, on en déduit l'agence.
            if ($departmentId && ! $agencyId) {
                $agencyId = Department::where('id', $departmentId)->value('agency_id');
            }

            if ($agencyId) {
                $user->assignments()->attach($agencyId, [
                    // is_primary désigne le CHEF d'agence, pas l'agence principale du
                    // compte : l'index unique partiel uq_agency_chief n'autorise qu'un
                    // seul is_primary par agence, et UserAssignmentController::assignChief
                    // démute le titulaire précédent. Le marquer ici hissait tout nouvel
                    // employé au rang de chef d'agence et faisait échouer la création
                    // (violation de clé unique) dès qu'un chef existait sur l'agence.
                    // Le rattachement simple suffit : le périmètre (ScopeService) et les
                    // listes du caissier lisent toutes les affectations, pas ce drapeau.
                    'is_primary' => false,
                    'is_department_chief' => false,
                    'department_id' => $departmentId,
                ]);
            }

            return $user;
        });

        // Un compte commercial doit disposer dès sa création de son profil
        // métier (table commercials) : sans lui, son tableau de bord reste vide
        // (« aucun profil commercial associé »).
        $this->commercialProfileService->ensureFor($user->fresh(), $data['agency_id'] ?? null);

        $this->logger->log(
            action: 'created',
            entityType: 'user',
            entityId: $user->id,
            description: "Utilisateur {$user->first_name} {$user->last_name} créé",
            newValues: ['email' => $user->email],
            request: $request,
        );

        $this->welcomeEmailService->send($user, $plainPassword);

        return (new UserResource($user->fresh()->load('role', 'assignments')))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/users/{user}',
        summary: 'Afficher un utilisateur',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de l\'utilisateur', content: new OA\JsonContent(ref: '#/components/schemas/User')),
            new OA\Response(response: 404, description: 'Utilisateur non trouvé'),
        ]
    )]
    public function show(Request $request, User $user)
    {
        $with = array_unique(array_merge(['role', 'assignments.agency'], $this->parseWith($request)));

        return new UserResource($user->load($with));
    }

    #[OA\Put(
        path: '/api/users/{user}',
        summary: 'Modifier un utilisateur',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'username', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'first_name', type: 'string'),
                    new OA\Property(property: 'last_name', type: 'string'),
                    new OA\Property(property: 'phone', type: 'string'),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                    new OA\Property(property: 'role_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'password', type: 'string', format: 'password'),
                    new OA\Property(property: 'password_confirmation', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Utilisateur modifié', content: new OA\JsonContent(ref: '#/components/schemas/User')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdateUserRequest $request, User $user)
    {
        $validated = $request->validated();

        $oldRoleId = $user->role_id;

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        // Promotion d'un employé existant vers le rôle commercial : son profil
        // métier est créé au passage pour éviter le dashboard vide. La relation
        // « role » doit être rechargée : elle pointe encore vers l'ancien rôle
        // après le update().
        $newRoleName = $user->fresh()?->role?->name;
        if ($newRoleName === 'commercial' && $oldRoleId !== $user->role_id) {
            $this->commercialProfileService->ensureFor($user->fresh());
        }

        $this->logger->log(
            action: isset($validated['role_id']) && (string) $validated['role_id'] !== (string) $oldRoleId ? 'role_changed' : 'updated',
            entityType: 'user',
            entityId: $user->id,
            description: "Utilisateur {$user->first_name} {$user->last_name} modifié",
            oldValues: isset($validated['role_id']) ? ['role_id' => $oldRoleId] : null,
            newValues: isset($validated['role_id']) ? ['role_id' => $validated['role_id']] : $user->getChanges(),
            request: $request,
        );

        return new UserResource($user->fresh()->load('role', 'assignments'));
    }

    /**
     * Réinitialise le mot de passe d'un utilisateur à la demande d'un
     * administrateur : un mot de passe provisoire est généré puis transmis par
     * email. Les liens de réinitialisation en cours sont invalidés et les
     * sessions actives révoquées, l'ancien mot de passe ne devant plus servir.
     */
    #[OA\Post(
        path: '/api/users/{user}/reset-password',
        summary: 'Réinitialiser le mot de passe d\'un utilisateur',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Mot de passe réinitialisé, le nouveau mot de passe a été envoyé par email'),
            new OA\Response(response: 403, description: 'Rôle non autorisé'),
        ]
    )]
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $actorRole = $request->user()?->role?->name;

        abort_unless(in_array($actorRole, ['super-admin', 'direction-generale'], true), 403, 'Vous n\'êtes pas autorisé à réinitialiser un mot de passe.');

        // La direction générale ne peut pas réinitialiser un super-administrateur.
        abort_if($user->role?->name === 'super-admin' && $actorRole !== 'super-admin', 403, 'Vous ne pouvez pas réinitialiser le mot de passe d\'un super-administrateur.');

        $plainPassword = Str::password(16);

        $user->update([
            'password' => Hash::make($plainPassword),
            'is_password_change_required' => true,
        ]);

        // Les demandes de réinitialisation et les sessions précédentes ne
        // doivent plus donner accès au compte.
        DB::table('password_reset_tokens')->where('email', $user->email)->delete();
        $user->tokens()->delete();

        $this->logger->log(
            action: 'password_reset',
            entityType: 'user',
            entityId: $user->id,
            description: "Mot de passe de {$user->first_name} {$user->last_name} réinitialisé par un administrateur",
            request: $request,
        );

        $this->sendAdminPasswordResetEmail($user, $plainPassword);

        return response()->json([
            'message' => 'Mot de passe réinitialisé. Un email avec les nouveaux accès a été envoyé à l\'utilisateur.',
        ]);
    }

    private function sendAdminPasswordResetEmail(User $user, string $plainPassword): void
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        try {
            Mail::to($user->email)->send(new AdminPasswordResetMail(
                user: $user->loadMissing('role'),
                plainPassword: $plainPassword,
                loginUrl: $frontendUrl !== '' ? $frontendUrl.'/login' : null,
            ));
        } catch (\Throwable $e) {
            Log::error("Échec de l'envoi de l'email de réinitialisation à l'utilisateur {$user->id} : ".$e->getMessage());
        }
    }

    #[OA\Delete(
        path: '/api/users/{user}',
        summary: 'Supprimer un utilisateur',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Utilisateur supprimé'),
            new OA\Response(response: 403, description: 'Impossible de supprimer un super administrateur'),
        ]
    )]
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'Vous ne pouvez pas supprimer votre propre compte.',
            ], 422);
        }

        if ($user->role?->name === 'super-admin') {
            $superAdminCount = User::where('role_id', $user->role_id)->count();
            if ($superAdminCount <= 1) {
                return response()->json([
                    'message' => 'Impossible de supprimer le dernier super-administrateur.',
                ], 422);
            }
        }

        $user->tokens()->delete();
        $user->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'user',
            entityId: $user->id,
            description: "Utilisateur {$user->first_name} {$user->last_name} supprimé",
            request: $request,
        );

        return response()->json(null, 204);
    }
}
