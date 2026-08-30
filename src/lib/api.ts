import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Hardcoded API Base URLs for live backend services
 * Used for Capacitor native iOS/Android apps and remote fallbacks.
 */
export const RENDER_BACKEND_URL = 'https://vox-ai-repo.onrender.com';
export const LIVE_BACKEND_URL = 'https://ais-dev-sefrhwmpi2727osvklse3f-2538769099.europe-west2.run.app';
export const SECONDARY_BACKEND_URL = 'https://ais-pre-sefrhwmpi2727osvklse3f-2538769099.europe-west2.run.app';

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
 * Native iOS / Android -> Live Render backend
 * Web -> '' (relative)
 */
export const API_BASE_URL: string = isNativeCapacitor()
  ? RENDER_BACKEND_URL
  : '';

export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = isNativeCapacitor() ? RENDER_BACKEND_URL : '';
  return `${baseUrl}${cleanEndpoint}`;
};

/**
 * Helper to check if a response body is an unwanted HTML document
 * (e.g. Google Cloud preview sign-in page or dev auth interstitial)
 */
function isHtmlDocument(body: string): boolean {
  if (!body) return false;
  const trimmed = body.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('accounts.google.com') ||
    trimmed.includes('__cookie_check') ||
    (trimmed.startsWith('<') && trimmed.includes('</head>'))
  );
}

export async function safeApiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isNative = isNativeCapacitor();

  const candidateUrls: string[] = [];

  if (isNative) {
    // In native iOS/Android, Render backend is open without Google preview cookie barriers
    candidateUrls.push(`${RENDER_BACKEND_URL}${cleanEndpoint}`);
    candidateUrls.push(`${SECONDARY_BACKEND_URL}${cleanEndpoint}`);
    candidateUrls.push(`${LIVE_BACKEND_URL}${cleanEndpoint}`);
  } else {
    // In browser, relative URL hits the Vite/Express dev server directly
    candidateUrls.push(cleanEndpoint);
    candidateUrls.push(`${RENDER_BACKEND_URL}${cleanEndpoint}`);
    candidateUrls.push(`${SECONDARY_BACKEND_URL}${cleanEndpoint}`);
    candidateUrls.push(`${LIVE_BACKEND_URL}${cleanEndpoint}`);
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
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            ...(options?.headers as Record<string, string>)
          },
          data: bodyData,
          connectTimeout: 8000,
          readTimeout: 20000
        });

        const status = nativeRes.status || 200;
        const responseBody = typeof nativeRes.data === 'object' ? JSON.stringify(nativeRes.data) : String(nativeRes.data || '');

        // If endpoint is a JSON endpoint but returned an HTML preview auth challenge, skip to next candidate
        if (!cleanEndpoint.startsWith('/api/tts') && isHtmlDocument(responseBody)) {
          console.warn(`[safeApiFetch] Received HTML challenge from ${url}, trying next candidate...`);
          continue;
        }

        const res = new Response(responseBody, {
          status: status,
          headers: (nativeRes.headers as Record<string, string>) || { 'Content-Type': 'application/json' },
        });

        if (res.ok || status === 400 || status === 401 || status === 403 || status === 422) {
          return res;
        }
      } catch (nativeHttpErr) {
        lastError = nativeHttpErr;
        console.warn(`Native CapacitorHttp to ${url} skipped:`, nativeHttpErr);
      }
    }

    // 2. Standard fetch with abort timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          ...options?.headers,
        }
      });
      clearTimeout(timeoutId);

      // Clone and inspect text to avoid accepting HTML auth challenges
      if (res.ok && !cleanEndpoint.startsWith('/api/tts')) {
        const cloned = res.clone();
        const text = await cloned.text();
        if (isHtmlDocument(text)) {
          console.warn(`[safeApiFetch] Received HTML login from ${url}, trying next...`);
          continue;
        }
      }

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


