export class ApiError extends Error {
  constructor(message, { status, details = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('No se pudo contactar con el servidor.', { status: 0 });
  }

  if (response.status === 204) return null;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.error ?? `Error ${response.status}`, {
      status: response.status,
      details: body?.details ?? [],
    });
  }

  return body;
}

export const api = {
  health: () => request('/health'),
  catalog: () => request('/api/catalog'),
  listPromotions: () => request('/api/promotions'),
  summary: () => request('/api/promotions/summary'),

  createPromotion: (payload) =>
    request('/api/promotions', { method: 'POST', body: JSON.stringify(payload) }),

  updatePromotion: (id, payload) =>
    request(`/api/promotions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  changeStatus: (id, status) =>
    request(`/api/promotions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deletePromotion: (id) => request(`/api/promotions/${id}`, { method: 'DELETE' }),
};
