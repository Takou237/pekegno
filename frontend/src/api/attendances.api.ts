import { client } from './client';
import type { Attendance, AttendanceBulkItem } from '@/types/attendance';

export const attendancesApi = {
  list(sessionId: string): Promise<Attendance[]> {
    return client.get(`/training-sessions/${sessionId}/attendances`).then((r) => r.data);
  },
  bulkUpdate(sessionId: string, items: AttendanceBulkItem[]): Promise<{ message: string }> {
    return client.put(`/training-sessions/${sessionId}/attendances`, { attendances: items }).then((r) => r.data);
  },
};
