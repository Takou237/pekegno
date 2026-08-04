import { client } from './client';
import type {
  Permission,
  PermissionPayload,
  RoleListItem,
  RolePayload,
} from '@/types/user';

export const rolesApi = {
  async list(): Promise<RoleListItem[]> {
    const { data } = await client.get<RoleListItem[]>('/roles');
    return data;
  },

  async create(payload: RolePayload): Promise<RoleListItem> {
    const { data } = await client.post<RoleListItem>('/roles', payload);
    return data;
  },

  async update(id: string, payload: RolePayload): Promise<RoleListItem> {
    const { data } = await client.put<RoleListItem>(`/roles/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/roles/${id}`);
  },

  async syncPermissions(roleId: string, permissionIds: string[]): Promise<RoleListItem> {
    const { data } = await client.put<RoleListItem>(`/roles/${roleId}/permissions`, {
      permissions: permissionIds,
    });
    return data;
  },

  async listPermissions(): Promise<Permission[]> {
    const { data } = await client.get<Permission[]>('/permissions');
    return data;
  },

  async createPermission(payload: PermissionPayload): Promise<Permission> {
    const { data } = await client.post<Permission>('/permissions', payload);
    return data;
  },

  async updatePermission(id: string, payload: PermissionPayload): Promise<Permission> {
    const { data } = await client.put<Permission>(`/permissions/${id}`, payload);
    return data;
  },

  async deletePermission(id: string): Promise<void> {
    await client.delete(`/permissions/${id}`);
  },
};
