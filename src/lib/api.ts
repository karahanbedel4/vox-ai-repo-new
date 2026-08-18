/**
 * Hardcoded API Base URL for live Render backend (https://vox-ai-repo.onrender.com)
 * Used as primary for Capacitor native apps and fallback for web apps.
 */
export const LIVE_BACKEND_URL = 'https://vox-ai-repo.onrender.com';

export const isNativeCapacitor = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || !!(window as any).Capacitor?.isNativePlatform();
};

export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // In web environment, use relative path so local server / Cloud Run container serves the endpoint directly
  if (typeof window !== 'undefined' && !isNativeCapacitor()) {
    return cleanEndpoint;
  }
  return `${LIVE_BACKEND_URL}${cleanEndpoint}`;
};

export async function safeApiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const primaryUrl = getApiUrl(cleanEndpoint);
  
  try {
    const res = await fetch(primaryUrl, options);
    if (res.ok) return res;
    
    // If relative endpoint returned non-200 and we are on web, attempt fallback to LIVE_BACKEND_URL
    if (!primaryUrl.startsWith('http')) {
      const fallbackUrl = `${LIVE_BACKEND_URL}${cleanEndpoint}`;
      const fallbackRes = await fetch(fallbackUrl, options);
      if (fallbackRes.ok) return fallbackRes;
    }
    return res;
  } catch (err) {
    // Network failure on primaryUrl: try fallback URL
    const secondaryUrl = primaryUrl.startsWith('http') 
      ? cleanEndpoint 
      : `${LIVE_BACKEND_URL}${cleanEndpoint}`;
    try {
      return await fetch(secondaryUrl, options);
    } catch {
      throw err;
    }
  }
}


