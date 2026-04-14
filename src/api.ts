// MongoDB-style API client — replaces Firestore
// All data goes to local Express backend (no Firebase permissions needed)

const BASE = 'http://localhost:5000/api';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

// ── USERS ──────────────────────────────────────────────────────────────────
export async function getUser(uid: string) {
  return apiFetch(`/users/${uid}`);
}
export async function createUser(data: any) {
  return apiFetch('/users', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateUser(uid: string, data: any) {
  return apiFetch(`/users/${uid}`, { method: 'PUT', body: JSON.stringify(data) });
}

// ── CROPS ──────────────────────────────────────────────────────────────────
export async function getCrops(filter?: { farmerId?: string; statuses?: string }) {
  const params = new URLSearchParams();
  if (filter?.farmerId) params.set('farmerId', filter.farmerId);
  if (filter?.statuses) params.set('statuses', filter.statuses);
  return apiFetch(`/crops?${params}`);
}
export async function createCrop(data: any) {
  return apiFetch('/crops', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateCrop(id: string, data: any) {
  return apiFetch(`/crops/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteCrop(id: string) {
  return apiFetch(`/crops/${id}`, { method: 'DELETE' });
}

// ── BIDS ───────────────────────────────────────────────────────────────────
export async function getBids(filter?: { farmerId?: string; buyerId?: string; cropId?: string }) {
  const params = new URLSearchParams();
  if (filter?.farmerId) params.set('farmerId', filter.farmerId);
  if (filter?.buyerId) params.set('buyerId', filter.buyerId);
  if (filter?.cropId) params.set('cropId', filter.cropId);
  return apiFetch(`/bids?${params}`);
}
export async function createBid(data: any) {
  return apiFetch('/bids', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateBid(id: string, data: any) {
  return apiFetch(`/bids/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// ── LOGISTICS ─────────────────────────────────────────────────────────────
export async function getLogistics(filter?: { available?: boolean; userId?: string }) {
  const params = new URLSearchParams();
  if (filter?.available) params.set('available', 'true');
  if (filter?.userId) params.set('userId', filter.userId);
  return apiFetch(`/logistics?${params}`);
}
export async function createLogistics(data: any) {
  return apiFetch('/logistics', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateLogistics(id: string, data: any) {
  return apiFetch(`/logistics/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteLogistics(id: string) {
  return apiFetch(`/logistics/${id}`, { method: 'DELETE' });
}

// ── BOOKINGS ──────────────────────────────────────────────────────────────
export async function getBookings(filter?: { farmerId?: string; buyerId?: string; logisticsId?: string }) {
  const params = new URLSearchParams();
  if (filter?.farmerId) params.set('farmerId', filter.farmerId);
  if (filter?.buyerId) params.set('buyerId', filter.buyerId);
  if (filter?.logisticsId) params.set('logisticsId', filter.logisticsId);
  return apiFetch(`/bookings?${params}`);
}
export async function createBooking(data: any) {
  return apiFetch('/bookings', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateBooking(id: string, data: any) {
  return apiFetch(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────
export async function getNotifications(userId: string) {
  return apiFetch(`/notifications?userId=${userId}`);
}
export async function createNotification(data: any) {
  return apiFetch('/notifications', { method: 'POST', body: JSON.stringify(data) });
}
export async function markNotificationRead(id: string) {
  return apiFetch(`/notifications/${id}`, { method: 'PUT', body: JSON.stringify({ read: true }) });
}
