import type { ChartData, Faq, Retailer, ShootingRange, Suggestion } from '../../shared/const';

export type RetailerForm = Omit<Retailer, 'id'>;
export type RangeForm = Omit<ShootingRange, 'id'>;
export interface SuggestionForm {
  name?: string; address?: string; city?: string; province?: string;
  website?: string; note?: string; kind: 'new' | 'update' | 'feedback'; turnstileToken: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const getRetailers = () => request<Retailer[]>('/api/retailers');

export const getRanges = () => request<ShootingRange[]>('/api/ranges');

export const getCharts = () => request<ChartData>('/api/charts');

export const getMeta = () => request<{ asOf: string }>('/api/meta');

export const postSuggestion = async (data: SuggestionForm): Promise<void> => {
  await request('/api/suggest', { method: 'POST', body: JSON.stringify(data) });
};

export const getFaqs = () => request<Faq[]>('/api/faqs');

export type FaqForm = Omit<Faq, 'id'>;

export const admin = {
  refreshSheets: async (): Promise<void> => {
    await request('/api/admin/refresh-sheets', { method: 'POST' });
  },
  snapshot: () => request<{ ok: boolean; files: string[] }>('/api/admin/snapshot', { method: 'POST' }),
  getFaqs: () => request<Faq[]>('/api/faqs', { cache: 'no-store' }),
  createFaq: async (data: FaqForm): Promise<number> =>
    (await request<{ id: number }>('/api/admin/faqs', { method: 'POST', body: JSON.stringify(data) })).id,
  updateFaq: async (id: number, data: FaqForm): Promise<void> => {
    await request(`/api/admin/faqs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteFaq: async (id: number): Promise<void> => {
    await request(`/api/admin/faqs/${id}`, { method: 'DELETE' });
  },
  getRetailers: () => request<Retailer[]>('/api/retailers', { cache: 'no-store' }),
  createRetailer: async (data: RetailerForm) =>
    (await request<{ id: number }>('/api/admin/retailers', { method: 'POST', body: JSON.stringify(data) })).id,
  updateRetailer: async (id: number, data: RetailerForm): Promise<void> => {
    await request(`/api/admin/retailers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteRetailer: async (id: number): Promise<void> => {
    await request(`/api/admin/retailers/${id}`, { method: 'DELETE' });
  },
  getRanges: () => request<ShootingRange[]>('/api/admin/ranges', { cache: 'no-store' }),
  createRange: async (data: RangeForm) =>
    (await request<{ id: number }>('/api/admin/ranges', { method: 'POST', body: JSON.stringify(data) })).id,
  updateRange: async (id: number, data: RangeForm): Promise<void> => {
    await request(`/api/admin/ranges/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteRange: async (id: number): Promise<void> => {
    await request(`/api/admin/ranges/${id}`, { method: 'DELETE' });
  },
  getSuggestions: () => request<Suggestion[]>('/api/admin/suggestions'),
  resolveGmaps: (url: string) =>
    request<{ name: string | null; lat: number | null; lon: number | null }>('/api/admin/resolve-gmaps', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  setSuggestionStatus: async (id: number, status: 'approved' | 'rejected'): Promise<void> => {
    await request(`/api/admin/suggestions/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
  },
};
