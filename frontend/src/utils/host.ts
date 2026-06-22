/** True when running on Netlify / public host (not localhost dev). */
export function isPublicHost(): boolean {
  if (import.meta.env.DEV) return false;
  const h = typeof window !== "undefined" ? window.location.hostname : "";
  return h !== "127.0.0.1" && h !== "localhost";
}

export function hasApiBaseUrl(): boolean {
  return Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
}
