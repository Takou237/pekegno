<?php

namespace App\Services;

use App\Models\CashClosing;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Support\Money;
use App\Support\Period;
use App\Support\TreasuryFlows;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * T2.8 / T2.9 — clôture d'une caisse.
 *
 * La caissière clôture sa caisse quand sa journée de travail est finie : la
 * caisse se ferme jusqu'à sa réouverture. Le solde théorique est le solde
 * comptable à la clôture ; la caissière saisit le solde physique constaté. Tout écart non nul exige une
 * justification (T2.9) et déclenche une alerte au chef d'agence (T2.10).
 */
class CashClosingService
{
    public const VALIDATOR_ROLES = ['responsable-agence', 'direction-generale', 'super-admin'];

    public function __construct(private readonly AgencyNotifier $notifier) {}

    /**
     * Journée métier de la caisse, en heure locale de son agence (B29, R3) :
     * à Douala, un encaissement de 00:30 appartient au jour qui commence, pas à
     * la veille UTC.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    private function dayBounds(TreasuryAccount $account, string $closingDate): array
    {
        return Period::dayBoundsUtc($closingDate, Period::timezoneForAgency($account->agency));
    }

    public function theoreticalBalance(TreasuryAccount $account, string $closingDate): float
    {
        [, $endOfDay] = $this->dayBounds($account, $closingDate);

        return Money::round((float) $account->opening_balance + $this->netBetween($account, null, $endOfDay), 2);
    }

    /**
     * Détail du jour d'une caisse (cahier §2) : solde initial, entrées,
     * sorties, transferts reçus / envoyés et solde théorique.
     *
     * @return array{opening: float, in: float, out: float, transfer_in: float, transfer_out: float, closing: float}
     */
    public function dayBreakdown(TreasuryAccount $account, string $closingDate): array
    {
        [$start, $end] = $this->dayBounds($account, $closingDate);
        [$flowSql, $bindings] = TreasuryFlows::selectSql();

        $row = DB::table('treasury_transactions')
            ->whereNull('deleted_at')
            ->where('treasury_account_id', $account->id)
            ->where('transacted_at', '<=', $end)
            ->selectRaw($flowSql, array_fill(0, $bindings, $start))
            ->first();

        return TreasuryFlows::fromRow($row, (float) $account->opening_balance);
    }

    /** Solde initial = solde final de la veille (cahier §2). */
    public function openingBalance(TreasuryAccount $account, string $closingDate): float
    {
        [$startOfDay] = $this->dayBounds($account, $closingDate);

        return Money::round(
            (float) $account->opening_balance + $this->netBetween($account, null, $startOfDay->copy()->subSecond()),
            2
        );
    }

    /**
     * Journée en cours d'une caisse : depuis sa dernière clôture (ou depuis
     * toujours) jusqu'à maintenant. Une journée n'est pas un jour du
     * calendrier : elle commence à la réouverture et finit à la clôture.
     *
     * @return array{opening: float, in: float, out: float, transfer_in: float, transfer_out: float, closing: float, is_closed: bool, since: ?string, closed_at: ?string, open_closing_id: ?string}
     */
    public function currentJourney(TreasuryAccount $account): array
    {
        $open = CashClosing::openFor($account->id);
        if ($open) {
            // Caisse fermée : on montre la journée clôturée, figée.
            return $this->between($account, $open->opened_at, $open->closed_at) + [
                'is_closed' => true,
                'since' => $open->opened_at?->toIso8601String(),
                'closed_at' => $open->closed_at?->toIso8601String(),
                'open_closing_id' => $open->id,
            ];
        }

        $since = CashClosing::lastClosedAt($account->id);

        return $this->between($account, $since, now()) + [
            'is_closed' => false,
            'since' => $since?->toIso8601String(),
            'closed_at' => null,
            'open_closing_id' => null,
        ];
    }

    /**
     * Détail d'une journée (cahier §2) entre deux instants : solde initial,
     * entrées, sorties, transferts reçus / envoyés, solde théorique.
     *
     * @return array{opening: float, in: float, out: float, transfer_in: float, transfer_out: float, closing: float}
     */
    public function between(TreasuryAccount $account, ?\DateTimeInterface $from, ?\DateTimeInterface $to): array
    {
        [$flowSql, $bindings] = TreasuryFlows::selectSql();
        // Un mouvement à l'instant exact de la clôture appartient à la journée close.
        $start = $from ? Carbon::instance($from)->addSecond() : Carbon::create(1970);

        $row = DB::table('treasury_transactions')
            ->whereNull('deleted_at')
            ->where('treasury_account_id', $account->id)
            ->where('transacted_at', '<=', $to ?? now())
            ->selectRaw($flowSql, array_fill(0, $bindings, $start))
            ->first();

        return TreasuryFlows::fromRow($row, (float) $account->opening_balance);
    }

    /**
     * Clôture = fin de la journée de travail, décidée par la caissière. La
     * caisse se ferme : rien n'y entre ni n'en sort, et les paiements de
     * l'agence attendent sa réouverture. Le solde final calculé devient le
     * solde initial de la journée suivante.
     */
    public function close(
        User $user,
        TreasuryAccount $account,
        float $actualBalance,
        ?string $justification = null,
    ): CashClosing {
        abort_if(CashClosing::openFor($account->id) !== null, 422, 'Cette caisse est déjà clôturée : rouvrez-la pour commencer une nouvelle journée.');

        $now = now();
        $since = CashClosing::lastClosedAt($account->id);
        $journey = $this->between($account, $since, $now);
        $theoretical = Money::round($journey['closing'], 2);
        $difference = Money::round($actualBalance - $theoretical, 2);
        $justification = trim((string) $justification);

        abort_if(
            $difference !== 0.0 && $justification === '',
            422,
            "Un écart de {$difference} doit être justifié."
        );

        $closing = CashClosing::create([
            'agency_id' => $account->agency_id,
            'treasury_account_id' => $account->id,
            'closing_date' => $now->copy()->timezone(Period::timezoneForAgency($account->agency))->toDateString(),
            'opened_at' => $since,
            'closed_at' => $now,
            'opening_balance' => Money::round($journey['opening'], 2),
            'theoretical_balance' => $theoretical,
            'actual_balance' => Money::round($actualBalance, 2),
            'difference' => $difference,
            'justification' => $justification !== '' ? $justification : null,
            'status' => CashClosing::STATUS_CLOSED,
            'closed_by' => $user->id,
        ]);

        if ($closing->hasDifference() && $account->agency_id) {
            $this->alertDiscrepancy($closing, $account->agency_id);
        }

        return $closing->load('account');
    }

    /** Réouverture : une nouvelle journée commence, au solde final de la clôture. */
    public function reopen(User $user, TreasuryAccount $account): CashClosing
    {
        $open = CashClosing::openFor($account->id);
        abort_if($open === null, 422, 'Cette caisse est déjà ouverte.');

        $open->update(['reopened_at' => now(), 'reopened_by' => $user->id]);

        return $open->load('account');
    }

    /**
     * Toute validation de paiement de l'agence attend la réouverture de sa
     * caisse espèces quand la caissière l'a clôturée.
     */
    public function assertAgencyOpen(?string $agencyId): void
    {
        if (! $agencyId) {
            return;
        }

        $open = CashClosing::query()
            ->whereNull('reopened_at')
            ->whereHas('account', fn ($q) => $q->where('agency_id', $agencyId)->where('type', 'cash'))
            ->with('account')
            ->latest('closed_at')
            ->first();

        abort_if($open !== null, 422, sprintf(
            'La caisse %s de l\'agence est clôturée depuis le %s : les encaissements et validations attendent sa réouverture.',
            $open?->account?->code ?? 'C',
            $open?->closed_at?->timezone(Period::timezoneForAgency($open?->account?->agency))->format('d/m/Y à H:i') ?? '?',
        ));
    }

    /**
     * Validation par le chef d'agence (T2.10) ou la direction — jamais par la
     * personne qui a fait la clôture.
     */
    public function validate(CashClosing $closing, User $validator): CashClosing
    {
        $role = $validator->role?->name;
        abort_unless(
            in_array($role, self::VALIDATOR_ROLES, true),
            403,
            "Seuls le chef d'agence et la direction peuvent valider une clôture de caisse."
        );
        abort_if(
            $closing->closed_by !== null && $closing->closed_by === $validator->id,
            403,
            'La clôture doit être validée par une autre personne que celle qui l\'a faite.'
        );

        if ($closing->status !== CashClosing::STATUS_VALIDATED) {
            $closing->update([
                'status' => CashClosing::STATUS_VALIDATED,
                'validated_by' => $validator->id,
                'validated_at' => now(),
            ]);
        }

        return $closing->load('account');
    }

    private function netBetween(TreasuryAccount $account, ?Carbon $from, Carbon $to): float
    {
        $query = TreasuryTransaction::where('treasury_account_id', $account->id)
            ->when($from, fn ($q) => $q->where('transacted_at', '>=', $from))
            ->where('transacted_at', '<=', $to);

        $in = (float) (clone $query)->where('direction', TreasuryTransaction::DIRECTION_IN)->sum('amount');
        $out = (float) (clone $query)->where('direction', TreasuryTransaction::DIRECTION_OUT)->sum('amount');

        return $in - $out;
    }

    private function alertDiscrepancy(CashClosing $closing, string $agencyId): void
    {
        $body = sprintf(
            'La caisse %s a un écart de %s pour le %s : théorique %s, réel %s. Justification : %s',
            $closing->account?->name ?? 'inconnue',
            number_format((float) $closing->difference, 0, ',', ' '),
            $closing->closing_date->format('d/m/Y'),
            number_format((float) $closing->theoretical_balance, 0, ',', ' '),
            number_format((float) $closing->actual_balance, 0, ',', ' '),
            $closing->justification ?? 'aucune',
        );

        // Chef(s) d'agence et administrateurs (super-admin) sont alertés.
        $recipients = array_values(array_unique(array_merge(
            $this->notifier->agencyChiefIds($agencyId),
            \App\Models\User::whereHas('role', fn ($q) => $q->where('name', 'super-admin'))->where('is_active', true)->pluck('id')->all(),
        )));

        foreach ($recipients as $userId) {
            $this->notifier->notify(
                userId: $userId,
                type: 'cash_closing_discrepancy',
                title: 'Écart de caisse constaté',
                body: $body,
                entityType: 'cash_closing',
                entityId: $closing->id,
                data: [
                    'account_id' => $closing->treasury_account_id,
                    'difference' => (float) $closing->difference,
                    'closing_date' => $closing->closing_date->toDateString(),
                ],
                dedupeKey: "cash_closing:{$closing->id}:discrepancy",
            );
        }
    }
}
