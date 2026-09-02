import { API_BASE_URL } from '../config';

export interface RequestOptions extends RequestInit {
  authPassword?: string;
  skipCache?: boolean;
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

// In-Flight Promise Deduplication Map (Prevents duplicate parallel requests)
const inFlightRequests = new Map<string, Promise<any>>();

// Client-Side In-Memory Cache (15 Seconds TTL for idempotent GET requests)
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const responseCache = new Map<string, CacheEntry>();

export function clearApiClientCache() {
  responseCache.clear();
  inFlightRequests.clear();
}

export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { authPassword, headers, skipCache = false, ...customConfig } = options;
  const method = (customConfig.method || 'GET').toUpperCase();

  const activeAuth = authPassword || 
    (typeof window !== 'undefined' ? (sessionStorage.getItem('adminPassword') || localStorage.getItem('adminPassword') || '') : '');

  const reqHeaders: Record<string, string> = {
    ...(headers as Record<string, string> || {})
  };

  if (activeAuth) {
    reqHeaders['Authorization'] = activeAuth.startsWith('Bearer ') ? activeAuth : `Bearer ${activeAuth}`;
  }

  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // If mutation, invalidate client cache immediately
  if (method !== 'GET') {
    responseCache.clear();
  }

  // Cache key based on URL, method, and auth
  const cacheKey = `${method}:${url}:${reqHeaders['Authorization'] || 'public'}`;

  // Check cache for GET requests
  if (method === 'GET' && !skipCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }

    // Check if an identical GET request is currently in-flight
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>;
    }
  }

  const fetchPromise = (async () => {
    try {
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

      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json();

      // Store in short-term cache for GET
      if (method === 'GET' && !skipCache) {
        responseCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + 15 * 1000 // 15s TTL
        });
      }

      return data as T;
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development' && err?.name !== 'AbortError') {
        console.warn(`[apiClient] ${method} ${url} failed:`, err.message || err);
      }
      throw err;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  if (method === 'GET' && !skipCache) {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}
