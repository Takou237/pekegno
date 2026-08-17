import { client } from './client';

export type ExportKind =
  | 'agencies'
  | 'users'
  | 'services'
  | 'clients'
  | 'commercials'
  | 'employees'
  | 'invoices'
  | 'activity-logs'
  | 'accounting'
  | 'bilans'
  | 'commercial-report';

const FILENAMES: Record<ExportKind, string> = {
  agencies: 'agences.csv',
  users: 'utilisateurs.csv',
  services: 'services.csv',
  clients: 'clients.csv',
  commercials: 'commerciaux.csv',
  employees: 'employes.csv',
  invoices: 'factures.csv',
  'activity-logs': 'journal-activite.csv',
  accounting: 'comptabilite.csv',
  bilans: 'bilans-quotidiens.csv',
  'commercial-report': 'rapport-commercial.csv',
};

export async function downloadExport(kind: ExportKind): Promise<void> {
  const { data } = await client.get<Blob>(`/exports/${kind}`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = FILENAMES[kind];
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
