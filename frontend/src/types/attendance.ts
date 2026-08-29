export type AttendanceStatus = 'present' | 'absent';

export interface AttendanceRosterItem {
  formation_enrollment_id: string;
  learner_user_id: string;
  learner: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  status: AttendanceStatus | null;
  recorded_at: string | null;
}

export interface AttendanceBulkItem {
  learner_user_id: string;
  status: AttendanceStatus;
}

export function attendanceStatusLabel(
  status: AttendanceStatus,
  t: (key: string) => string,
): string {
  switch (status) {
    case 'present': return t('attendance.present');
    case 'absent': return t('attendance.absent');
    default: return status;
  }
}