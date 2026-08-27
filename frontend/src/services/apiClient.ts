import { API_BASE_URL } from '../config';

export interface RequestOptions extends RequestInit {
  authPassword?: string;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { authPassword, headers, ...customConfig } = options;

  const activeAuth = authPassword || 
    (typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') || '' : '');

  const reqHeaders: Record<string, string> = {
    ...(headers as Record<string, string> || {})
  };

  if (activeAuth) {
    reqHeaders['Authorization'] = activeAuth.startsWith('Bearer ') ? activeAuth : `Bearer ${activeAuth}`;
  }

  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    headers: reqHeaders,
    ...customConfig
  });

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch (_) {
      errorData = { error: response.statusText };
    }
    const message = errorData.error || errorData.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
