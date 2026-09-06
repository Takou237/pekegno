import { client } from './client';
import type { AttendanceBulkItem, AttendanceRosterItem } from '@/types/attendance';

export const attendancesApi = {
  list(sessionId: string, courseModuleId?: string | null): Promise<AttendanceRosterItem[]> {
    return client
      .get<{ attendances: AttendanceRosterItem[] }>(`/training-sessions/${sessionId}/attendances`, {
        params: courseModuleId ? { course_module_id: courseModuleId } : undefined,
      })
      .then((r) => r.data.attendances);
  },
  bulkUpdate(
    sessionId: string,
    items: AttendanceBulkItem[],
    courseModuleId?: string | null,
  ): Promise<{ attendances: AttendanceRosterItem[] }> {
    return client
      .put<{ attendances: AttendanceRosterItem[] }>(`/training-sessions/${sessionId}/attendances`, {
        attendances: items,
        course_module_id: courseModuleId ?? null,
      })
      .then((r) => r.data);
  },
};
