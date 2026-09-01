export type NotificationType =
  | 'info'
  | 'order_due'
  | 'order_validated'
  | 'order_declined'
  | 'success'
  | 'warning'
  | 'error';

export interface AppNotification {
  id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  is_read: boolean;
}
