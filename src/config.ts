export const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_API_URL?: string; DEV?: boolean } }).env?.VITE_API_URL) ||
  (typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV ? "http://localhost:5000" : "");

export const api = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
