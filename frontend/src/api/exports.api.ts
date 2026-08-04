import { client } from './client';

const FILENAMES: Record<string, string> = {
  agencies: 'agences.csv',
  users: 'utilisateurs.csv',
  services: 'services.csv',
};

export async function downloadExport(kind: 'agencies' | 'users' | 'services'): Promise<void> {
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
