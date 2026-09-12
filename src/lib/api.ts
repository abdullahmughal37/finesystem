import { api } from '@/config';
function expireSession(response: Response) {
  if (response.status !== 401 || !localStorage.getItem('library_token')) return;
  localStorage.removeItem('library_token');
  localStorage.removeItem('library_user');
  window.dispatchEvent(new Event('library-session-expired'));
}
export async function requestJson(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = localStorage.getItem('library_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(api(path), { ...options, headers });
  expireSession(response);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status}). Please try again.`);
  if (data === null) throw new Error('The server returned an unreadable response.');
  return data;
}
export function jsonBody(data: unknown): RequestInit { return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }; }
export function downloadCsv(name: string, headers: string[], rows: unknown[][]) {
  const cell = (value: unknown) => { let text = String(value ?? ''); if (/^\s*[=+\-@]/.test(text)) text = "'" + text; return `"${text.replaceAll('"', '""')}"`; };
  const url = URL.createObjectURL(new Blob(['\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadFile(path: string, fallbackName: string) {
  const headers = new Headers();
  const token = localStorage.getItem('library_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(api(path), { headers });
  expireSession(response);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || data?.message || `Download failed (${response.status}).`);
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = match?.[1] || fallbackName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
