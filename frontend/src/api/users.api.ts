import { client } from './client';
import type {
  RoleListItem,
  UpdateUserPayload,
  UserListParams,
  UserListItem,
} from '@/types/user';
import type { PaginatedResponse } from '@/types/agency';

export const usersApi = {
  async list(params: UserListParams = {}): Promise<PaginatedResponse<UserListItem>> {
    const { data } = await client.get<PaginatedResponse<UserListItem>>('/users', { params });
    return data;
  },

  async get(id: string): Promise<UserListItem> {
    const { data } = await client.get<UserListItem>(`/users/${id}`);
    return data;
  },

  async update(id: string, payload: UpdateUserPayload): Promise<UserListItem> {
    const { data } = await client.put<UserListItem>(`/users/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/users/${id}`);
  },

  async listRoles(): Promise<RoleListItem[]> {
    const { data } = await client.get<RoleListItem[]>('/roles');
    return data;
  },

  async assignRole(userId: string, roleId: string): Promise<UserListItem> {
    const { data } = await client.put<UserListItem>(`/users/${userId}/role`, {
      role_id: roleId,
    });
    return data;
  },
};
