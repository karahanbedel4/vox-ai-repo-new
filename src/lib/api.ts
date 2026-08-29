import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Hardcoded API Base URLs for live backend services
 * Used for Capacitor native iOS/Android apps and remote fallbacks.
 */
export const LIVE_BACKEND_URL = 'https://ais-dev-sefrhwmpi2727osvklse3f-2538769099.europe-west2.run.app';
export const SECONDARY_BACKEND_URL = 'https://ais-pre-sefrhwmpi2727osvklse3f-2538769099.europe-west2.run.app';
export const RENDER_BACKEND_URL = 'https://vox-ai-repo.onrender.com';

export const isNativeCapacitor = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {}
  return (
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
    !!(window as any).Capacitor?.isNativePlatform?.() ||
    !!(window as any).Capacitor?.isNative
  );
};

/**
 * Global API Base URL:
 * Native iOS / Android -> Live Cloud Run backend
 * Web -> '' (relative)
 */
export const API_BASE_URL: string = isNativeCapacitor()
  ? LIVE_BACKEND_URL
  : '';

export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = isNativeCapacitor() ? LIVE_BACKEND_URL : '';
  return `${baseUrl}${cleanEndpoint}`;
};

export async function safeApiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isNative = isNativeCapacitor();

  const candidateUrls: string[] = [];

  if (isNative) {
    // In native iOS/Android, ais-pre (public shared) and render are accessible without cloud run dev auth cookies
    candidateUrls.push(`${SECONDARY_BACKEND_URL}${cleanEndpoint}`);
    candidateUrls.push(`${RENDER_BACKEND_URL}${cleanEndpoint}`);
    candidateUrls.push(`${LIVE_BACKEND_URL}${cleanEndpoint}`);
  } else {
    candidateUrls.push(cleanEndpoint);
    candidateUrls.push(`${SECONDARY_BACKEND_URL}${cleanEndpoint}`);
    candidateUrls.push(`${LIVE_BACKEND_URL}${cleanEndpoint}`);
    candidateUrls.push(`${RENDER_BACKEND_URL}${cleanEndpoint}`);
  }

  let lastError: any = null;

  for (const url of candidateUrls) {
    // 1. Native Capacitor iOS/Android URLSession request (preferred on native)
    if (isNative && url.startsWith('http')) {
      try {
        let bodyData: any = undefined;
        if (options?.body) {
          if (typeof options.body === 'string') {
            try {
              bodyData = JSON.parse(options.body);
            } catch {
              bodyData = options.body;
            }
          } else {
            bodyData = options.body;
          }
        }

        const nativeRes = await CapacitorHttp.request({
          url: url,
          method: options?.method || 'GET',
          headers: (options?.headers as Record<string, string>) || { 'Content-Type': 'application/json' },
          data: bodyData,
          connectTimeout: 5000,
          readTimeout: 10000
        });

        const status = nativeRes.status || 200;
        const responseBody = typeof nativeRes.data === 'object' ? JSON.stringify(nativeRes.data) : String(nativeRes.data || '');
        const res = new Response(responseBody, {
          status: status,
          headers: nativeRes.headers as Record<string, string>,
        });

        if (res.ok || status === 400 || status === 401 || status === 403 || status === 422) {
          return res;
        }
      } catch (nativeHttpErr) {
        lastError = nativeHttpErr;
        console.warn(`Native CapacitorHttp to ${url} skipped:`, nativeHttpErr);
      }
    }

    // 2. Standard fetch with 6s abort timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        }
      });
      clearTimeout(timeoutId);

      if (res.ok) return res;
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
        return res;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt to ${url} skipped:`, err);
    }
  }

  throw lastError || new Error(`Sunucuya erişilemedi (${cleanEndpoint}). Lütfen internet bağlantınızı kontrol edin.`);
}


