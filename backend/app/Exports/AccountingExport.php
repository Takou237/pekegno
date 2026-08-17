<?php

namespace App\Exports;

use App\Models\AccountingTransaction;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class AccountingExport implements FromArray, WithHeadings, WithStyles
{
    public function __construct(private readonly Collection $transactions) {}

    public function headings(): array
    {
        return ['N°', 'Agence', 'Rubrique', 'Montant', 'Client', 'Date', 'Type', 'Opérateur', 'Objet', 'Bénéficiaire', 'Justification'];
    }

    public function array(): array
    {
        return $this->transactions->map(fn (AccountingTransaction $t) => [
            $t->number,
            $t->agency?->name ?? '',
            $t->label,
            (float) $t->amount,
            $t->client_id ? trim(($t->client?->first_name ?? '').' '.($t->client?->last_name ?? '')) : '',
            $t->transacted_at?->format('Y-m-d H:i'),
            $t->type === 'income' ? 'Entrée' : 'Sortie',
            $t->operator_id ? trim(($t->operator?->first_name ?? '').' '.($t->operator?->last_name ?? '')) : '',
            $t->note ?? '',
            $t->beneficiary ?? '',
            $t->justification ?? '',
        ])->all();
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true]],
        ];
    }
}
