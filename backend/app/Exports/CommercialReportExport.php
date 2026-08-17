<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class CommercialReportExport implements FromArray, WithHeadings, WithStyles
{
    public function __construct(private readonly array $report) {}

    public function headings(): array
    {
        return ['Commercial', 'Agence', 'Type', 'Ventes', 'CA facturé', 'CA encaissé', 'Tranches', 'Commissions', 'Points', 'Prospects', 'Clients convertis', 'Taux conversion %'];
    }

    public function array(): array
    {
        $rows = collect($this->report['ranking'])->map(fn (array $row) => [
            trim(($row['first_name'] ?? '').' '.($row['last_name'] ?? '')),
            $row['agency_name'] ?? '',
            $row['kind'] === 'employe' ? 'Employé' : 'Commercial',
            $row['sales_count'],
            $row['revenue_billed'],
            $row['revenue_received'],
            $row['payments_count'],
            $row['commissions'],
            $row['points'],
            $row['prospects_count'],
            $row['clients_converted'],
            $row['conversion_rate'],
        ])->all();

        $t = $this->report['totals'];

        $rows[] = [
            'TOTAL',
            '',
            '',
            $t['sales_count'],
            $t['revenue_billed'],
            $t['revenue_received'],
            $t['payments_count'],
            $t['commissions'],
            $t['points'],
            $t['prospects_count'],
            $t['clients_converted'],
            '',
        ];

        return $rows;
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true]],
            count($this->array()) + 1 => ['font' => ['bold' => true]],
        ];
    }
}
