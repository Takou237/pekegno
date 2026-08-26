export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Attendance {
  id: string;
  training_session_id: string;
  enrollment_id: string;
  status: AttendanceStatus;
  recorded_by: string | null;
  recorded_at: string | null;
  created_at: string;
  enrollment?: {
    id: string;
    learner?: { id: string; first_name: string; last_name: string; name?: string };
  };
}

export interface AttendanceBulkItem {
  enrollment_id: string;
  status: AttendanceStatus;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'En retard',
  excused: 'Excusé',
};
