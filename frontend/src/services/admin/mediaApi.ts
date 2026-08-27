import { apiClient } from '../apiClient';

export interface MediaViewTokenResponse {
  success: boolean;
  registrationId: string;
  fileId: string;
  filename: string;
  expiresAt: number;
  nonce: string;
  signature: string;
  viewerUrl: string;
}

export const mediaApi = {
  /**
   * Request short-lived signed view token for archived Google Drive original photo
   */
  getViewToken: (registrationId: string) => {
    return apiClient<MediaViewTokenResponse>(`/api/admin/media/${encodeURIComponent(registrationId)}/view-token`, {
      method: 'POST'
    });
  }
};
