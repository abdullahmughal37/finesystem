export const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  "http://localhost:5000";

export const api = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
