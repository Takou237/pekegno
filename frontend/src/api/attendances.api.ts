import { client } from './client';
import type { AttendanceBulkItem, AttendanceRosterItem } from '@/types/attendance';

export const attendancesApi = {
  list(sessionId: string): Promise<AttendanceRosterItem[]> {
    return client
      .get<{ attendances: AttendanceRosterItem[] }>(`/training-sessions/${sessionId}/attendances`)
      .then((r) => r.data.attendances);
  },
  bulkUpdate(sessionId: string, items: AttendanceBulkItem[]): Promise<{ attendances: AttendanceRosterItem[] }> {
    return client
      .put<{ attendances: AttendanceRosterItem[] }>(`/training-sessions/${sessionId}/attendances`, { attendances: items })
      .then((r) => r.data);
  },
};