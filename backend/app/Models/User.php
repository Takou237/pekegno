<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasUuids, Notifiable, SoftDeletes;

    protected $fillable = [
        'username',
        'email',
        'password',
        'first_name',
        'last_name',
        'phone',
        'role_id',
        'is_active',
        'failed_attempts',
        'locked_until',
        'two_factor_enabled',
        'two_factor_secret',
        'two_factor_channel',
        'active_session_id',
        'is_password_change_required',
        'last_activity_at',
        'client_number',
        'client_category_id',
        'status',
        'registered_agency_id',
        'commercial_user_id',
        'registered_at',
        'city',
        'country',
        'country_id',
        'city_id',
        'address',
        'nationality',
        'quartier',
        'occupation',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
    ];

    protected $with = ['role'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'failed_attempts' => 'integer',
            'locked_until' => 'datetime',
            'two_factor_enabled' => 'boolean',
            'is_password_change_required' => 'boolean',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'registered_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Rôles sensibles pour lesquels la double authentification est obligatoire
     * (Lot 9) : super-admin, direction générale, comptable et caissiers.
     */
    public function requiresTwoFactor(): bool
    {
        return in_array($this->role?->name, [
            'super-admin',
            'direction-generale',
            'comptable',
            'caissier',
        ], true);
    }

    public function clientCategory(): BelongsTo
    {
        return $this->belongsTo(ClientCategory::class);
    }

    /**
     * Relations vers la hiérarchie organisationnelle.
     * Nommées geo* car les colonnes legacy `country`/`city` (varchar)
     * occupent déjà les noms magiques correspondants.
     */
    public function geoCountry(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_id');
    }

    public function geoCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city_id');
    }

    public function registeredAgency(): BelongsTo
    {
        return $this->belongsTo(Agency::class, 'registered_agency_id');
    }

    public function referringCommercial(): BelongsTo
    {
        return $this->belongsTo(User::class, 'commercial_user_id');
    }

    public function clientSubscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class, 'client_id');
    }

    // Affectations via user_assignments (agence + département)
    public function assignments(): BelongsToMany
    {
        return $this->belongsToMany(Agency::class, 'user_assignments')
            ->withPivot('department_id', 'is_primary', 'is_department_chief')
            ->withTimestamps();
    }

    public function primaryAgency()
    {
        return $this->belongsToMany(Agency::class, 'user_assignments')
            ->wherePivot('is_primary', true)
            ->withPivot('department_id', 'is_primary', 'is_department_chief')
            ->withTimestamps();
    }

    public function commercialProfile(): HasOne
    {
        return $this->hasOne(Commercial::class, 'user_id');
    }

    /** Profil formateur lié au compte (« Compte lié » sur la fiche formateur). */
    public function trainerProfile(): HasOne
    {
        return $this->hasOne(Trainer::class, 'user_id');
    }

    public function invoicesSold(): HasMany
    {
        return $this->hasMany(Invoice::class, 'seller_user_id');
    }

    public function clientInvoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'client_id');
    }

    public function receivedPayments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class, 'received_by');
    }

    public function createdPoints(): HasMany
    {
        return $this->hasMany(CommercialPoint::class, 'created_by');
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    /**
     * Rôles qui vendent avec les fonctionnalités du commercial (périmètre limité
     * à leurs propres ventes, preuve de paiement, rapport, prospects…).
     * Le community-manager cumule ces fonctionnalités avec le suivi de ses prestations.
     */
    public const COMMERCIAL_ROLES = ['commercial', 'community-manager'];

    public function actsAsCommercial(): bool
    {
        return in_array($this->role?->name, self::COMMERCIAL_ROLES, true);
    }

    public function getIsClientAttribute(): bool
    {
        return $this->role?->name === 'client';
    }

    /**
     * Attribue le prochain numéro client sous verrou : deux créations
     * simultanées ne peuvent pas obtenir le même numéro (le verrou PostgreSQL
     * est tenu jusqu'à la fin de la transaction englobante).
     */
    public function assignClientNumber(): void
    {
        DB::transaction(function () {
            if (DB::getDriverName() === 'pgsql') {
                DB::select('SELECT pg_advisory_xact_lock(?)', [crc32('client_number')]);
            }

            $this->update(['client_number' => static::generateClientNumber()]);
        });
    }

    public static function generateClientNumber(): string
    {
        // withTrashed : un client supprimé (suppression logique) garde son
        // numéro en base ; l'ignorer faisait recalculer un numéro déjà pris
        // (contrainte d'unicité → erreur 500 à la création du client suivant).
        $last = static::withTrashed()
            ->where('client_number', 'like', 'CL-%')
            ->pluck('client_number')
            ->map(fn (string $number): int => preg_match('/^CL-(\d+)$/', $number, $matches) ? (int) $matches[1] : 0)
            ->max();

        return 'CL-'.str_pad((string) (($last ?: 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    /**
     * Suppression logique d'un client (alias historique de softDeleteAccount).
     */
    public function softDeleteClient(): void
    {
        $this->softDeleteAccount();
    }

    /**
     * Suppression logique d'un compte (client ou employé) : l'email et
     * l'identifiant de connexion sont libérés (suffixés) pour permettre une
     * nouvelle inscription avec les mêmes coordonnées, sans casser les
     * contraintes d'unicité ; les jetons de connexion sont révoqués.
     */
    public function softDeleteAccount(): void
    {
        $suffix = '.deleted.'.Str::lower((string) Str::ulid());

        $this->forceFill([
            'email' => $suffix.'@deleted.pekegno.local',
            'username' => $suffix,
        ])->save();

        $this->tokens()->delete();
        $this->delete();
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->role?->name === 'super-admin') {
            return true;
        }

        return in_array($permission, $this->permissionNames(), true);
    }

    public function hasAnyPermission(array $permissions): bool
    {
        if ($this->role?->name === 'super-admin') {
            return true;
        }

        return count(array_intersect($permissions, $this->permissionNames())) > 0;
    }

    private function permissionNames(): array
    {
        if ($this->cachedPermissionNames === null) {
            $this->cachedPermissionNames = $this->role?->permissions()->pluck('name')->all() ?? [];
        }

        return $this->cachedPermissionNames;
    }

    private ?array $cachedPermissionNames = null;
}
