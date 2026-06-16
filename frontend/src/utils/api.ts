import { getDeviceId } from "./deviceId";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const deviceId = await getDeviceId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getProfile: () => request("/profile"),
  updateProfile: (data: { name?: string; wallet_ton?: string }) =>
    request("/profile", { method: "PUT", body: JSON.stringify(data) }),
  listTrips: () => request("/trips"),
  getTrip: (id: string) => request(`/trips/${id}`),
  createTrip: (data: any) => request("/trips", { method: "POST", body: JSON.stringify(data) }),
  listAlerts: () => request("/alerts"),
  createAlert: (data: any) => request("/alerts", { method: "POST", body: JSON.stringify(data) }),
  getRewards: () => request("/rewards"),
  claimRewards: (amount: number = 1000) =>
    request("/rewards/claim", { method: "POST", body: JSON.stringify({ amount }) }),
  getSpeedLimit: (lat: number, lon: number) =>
    request(`/speed-limit?lat=${lat}&lon=${lon}`),
  getUpcomingLimits: (lat: number, lon: number, heading: number = 0) =>
    request(`/speed-limits/upcoming?lat=${lat}&lon=${lon}&heading=${heading}`),
  getWeather: (lat: number, lon: number) =>
    request(`/weather?lat=${lat}&lon=${lon}`),
  listDangerZones: (lat: number, lon: number, radius_km: number = 10) =>
    request(`/danger-zones?lat=${lat}&lon=${lon}&radius_km=${radius_km}`),
  reportDangerZone: (data: { lat: number; lon: number; type: string; note?: string }) =>
    request("/danger-zones", { method: "POST", body: JSON.stringify(data) }),
  savePushToken: (token: string) =>
    request("/profile/push-token", { method: "POST", body: JSON.stringify({ token }) }),
};
