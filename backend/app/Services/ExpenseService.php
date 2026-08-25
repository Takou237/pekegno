<?php

namespace App\Services;

use App\Models\AccountingCategory;
use App\Models\AccountingTransaction;
use App\Models\Expense;
use App\Models\TreasuryAccount;
use Illuminate\Support\Facades\DB;

class ExpenseService
{
    public function __construct(
        private readonly TreasuryService $treasuryService,
        private readonly AccountingService $accountingService,
        private readonly ActivityLogger $logger,
    ) {}

    public function submit(Expense $expense, string $actorUserId): Expense
    {
        $this->assertTransition($expense, Expense::STATUS_SUBMITTED);
        $expense->status = Expense::STATUS_SUBMITTED;
        $expense->save();
        $this->activity('soumise', $expense);

        return $expense;
    }

    public function approve(Expense $expense, string $actorUserId): Expense
    {
        $this->assertTransition($expense, Expense::STATUS_APPROVED);
        $expense->status = Expense::STATUS_APPROVED;
        $expense->approved_by = $actorUserId;
        $expense->approved_at = now();
        $expense->rejected_by = null;
        $expense->rejection_reason = null;
        $expense->save();
        $this->activity('approuvée', $expense);

        return $expense;
    }

    public function reject(Expense $expense, string $reason, string $actorUserId): Expense
    {
        abort_if(trim($reason) === '', 422, 'Une raison de rejet est obligatoire.');
        $this->assertTransition($expense, Expense::STATUS_REJECTED);

        $expense->status = Expense::STATUS_REJECTED;
        $expense->rejected_by = $actorUserId;
        $expense->rejection_reason = $reason;
        $expense->save();
        $this->activity("rejetée ({$reason})", $expense);

        return $expense;
    }

    public function pay(Expense $expense, string $accountId, string $actorUserId): Expense
    {
        $this->assertTransition($expense, Expense::STATUS_PAID);

        $account = TreasuryAccount::where('id', $accountId)->where('is_active', true)->first();
        abort_if(! $account, 422, 'Compte de trésorerie inexistant ou inactif.');

        DB::transaction(function () use ($expense, $account, $actorUserId) {
            $this->treasuryService->recordMovement(
                account: $account,
                direction: 'out',
                amount: (float) $expense->amount,
                label: "Dépense {$expense->number}",
                sourceType: 'expense',
                sourceId: $expense->id,
                category: $expense->category?->name ?: 'depense',
                reference: $expense->number,
                createdBy: $actorUserId,
            );

            $this->writeExpenseAccounting($expense, $account, $actorUserId);

            $expense->status = Expense::STATUS_PAID;
            $expense->treasury_account_id = $account->id;
            $expense->paid_by = $actorUserId;
            $expense->paid_at = now();
            $expense->save();
        });

        $this->activity('payée', $expense);

        return $expense;
    }

    public function close(Expense $expense, string $actorUserId): Expense
    {
        $this->assertTransition($expense, Expense::STATUS_CLOSED);
        $expense->status = Expense::STATUS_CLOSED;
        $expense->save();
        $this->activity('clôturée', $expense);

        return $expense;
    }

    public function reopen(Expense $expense, string $actorUserId): Expense
    {
        if ($expense->status !== Expense::STATUS_REJECTED) {
            abort(422, 'Seule une dépense rejetée peut être rouverte.');
        }
        $expense->status = Expense::STATUS_DRAFT;
        $expense->rejected_by = null;
        $expense->rejection_reason = null;
        $expense->save();
        $this->activity('rouverte', $expense);

        return $expense;
    }

    private function assertTransition(Expense $expense, string $target): void
    {
        $allowed = match ($target) {
            Expense::STATUS_SUBMITTED => in_array($expense->status, [Expense::STATUS_DRAFT], true),
            Expense::STATUS_APPROVED => in_array($expense->status, [Expense::STATUS_SUBMITTED], true),
            Expense::STATUS_REJECTED => in_array($expense->status, [Expense::STATUS_SUBMITTED], true),
            Expense::STATUS_PAID => in_array($expense->status, [Expense::STATUS_APPROVED], true),
            Expense::STATUS_CLOSED => in_array($expense->status, [Expense::STATUS_PAID], true),
            default => false,
        };

        abort_if(! $allowed, 422, "Transition '{$expense->status}' → '{$target}' interdite.");
    }

    private function writeExpenseAccounting(Expense $expense, TreasuryAccount $account, string $actorUserId): void
    {
        $category = AccountingCategory::where('id', $expense->category_id)->where('type', 'expense')->first();
        abort_if(! $category, 422, 'La catégorie comptable de la dépense doit être de type dépense.');

        AccountingTransaction::create([
            'number' => $this->accountingService->nextNumber(),
            'agency_id' => $expense->agency_id,
            'category_id' => $category->id,
            'type' => 'expense',
            'label' => "Dépense {$expense->number} — {$category->name}",
            'reference' => $expense->number,
            'amount' => (float) $expense->amount,
            'transacted_at' => now(),
            'operator_id' => $actorUserId,
            'note' => $expense->note,
            'beneficiary' => $account->name,
            'justification' => $expense->justification_path,
        ]);
    }

    private function activity(string $action, Expense $expense): void
    {
        $this->logger->log(
            action: 'expense',
            entityType: 'expense',
            entityId: $expense->id,
            description: "Dépense {$expense->number} {$action} (".$expense->amount.' FCFA)',
            oldValues: null,
            newValues: ['status' => $expense->status, 'amount' => (float) $expense->amount],
        );
    }
}