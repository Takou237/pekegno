import { client } from './client';

export interface UploadResponse {
  url: string;
  path: string;
}

export const uploadsApi = {
  async upload(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await client.post<UploadResponse>('/uploads', formData);
    return data;
  },
};
