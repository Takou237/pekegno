<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class DailyBilanExport implements FromArray, WithStyles
{
    public function __construct(private readonly array $bilan) {}

    public function array(): array
    {
        $b = $this->bilan;

        $rows = [
            ['BILAN DU JOUR'],
            ['Date', $b['date']],
            ['Agence', $b['agency']['name'] ?? 'Toutes les agences'],
            [],
            ['Service', 'Quantité vendue', 'Total'],
        ];

        foreach ($b['services'] as $service) {
            $rows[] = [$service['label'], $service['count'], (float) $service['total']];
        }

        $rows = array_merge($rows, [
            ['TOTAL SERVICES VENDUS', '', (float) $b['total_services_sold']],
            [],
            ['Encaissements cash', '', (float) $b['cash_total']],
            ['Encaissements mobile money', '', (float) $b['mobile_total']],
            ['Total encaissé (cash + mobile)', '', (float) $b['total_received']],
            [],
            ['Solde initial (veille)', '', (float) $b['solde_initial']],
            ['Dépense du jour', '', (float) $b['expense_total']],
            ['SOLDE FINAL (encaissé − dépense)', '', (float) $b['solde_final']],
            [],
            ['Cohérence cash + mobile = total services vendus', $b['coherence']['ok'] ? 'OK' : 'ÉCART DÉTECTÉ', ''],
        ]);

        return $rows;
    }

    public function styles(Worksheet $sheet): array
    {
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);

        foreach ($sheet->getRowIterator() as $row) {
            $value = $sheet->getCell('A'.$row->getRowIndex())->getValue();
            if (in_array($value, [
                'Service',
                'TOTAL SERVICES VENDUS',
                'Solde initial (veille)',
                'SOLDE FINAL (encaissé − dépense)',
            ], true)) {
                $sheet->getStyle('A'.$row->getRowIndex())->getFont()->setBold(true);
            }
        }

        return [];
    }
}
