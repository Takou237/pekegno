<?php

namespace App\Services;

use App\Models\CashClosing;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Support\Money;
use App\Support\Period;
use Carbon\Carbon;

/**
 * T2.8 / T2.9 — clôture journalière d'une caisse.
 *
 * Le solde théorique est le solde comptable à la fin de la journée ; la
 * caissière saisit le solde physique constaté. Tout écart non nul exige une
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

    /** Solde initial = solde final de la veille (cahier §2). */
    public function openingBalance(TreasuryAccount $account, string $closingDate): float
    {
        [$startOfDay] = $this->dayBounds($account, $closingDate);

        return Money::round(
            (float) $account->opening_balance + $this->netBetween($account, null, $startOfDay->copy()->subSecond()),
            2
        );
    }

    public function close(
        User $user,
        TreasuryAccount $account,
        string $closingDate,
        float $actualBalance,
        ?string $justification = null,
    ): CashClosing {
        $date = Carbon::parse($closingDate)->toDateString();

        abort_if(
            CashClosing::where('treasury_account_id', $account->id)->whereDate('closing_date', $date)->exists(),
            422,
            'Cette caisse est déjà clôturée pour cette date.'
        );

        $theoretical = $this->theoreticalBalance($account, $date);
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
            'closing_date' => $date,
            'opening_balance' => $this->openingBalance($account, $date),
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

        foreach ($this->notifier->agencyChiefIds($agencyId) as $userId) {
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
