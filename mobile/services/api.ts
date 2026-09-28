import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'luna_token';
const DRIVER_KEY = 'luna_driver';
const SERVER_URL_KEY = 'luna_server_url';

export async function getServerUrl(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(SERVER_URL_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return API_BASE_URL;
}

export async function setServerUrl(url: string): Promise<void> {
  try {
    if (!url || !url.trim() || url.trim() === API_BASE_URL) {
      await SecureStore.deleteItemAsync(SERVER_URL_KEY);
    } else {
      await SecureStore.setItemAsync(SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
    }
  } catch {}
}

export interface Driver {
  driverId: string;
  fio: string;
  token: string;
}

/** Авторизация по driverId (из QR-кода или ввода) */
export async function loginWithDriverId(driverId: string): Promise<Driver> {
  const baseUrl = await getServerUrl();
  const res = await fetch(`${baseUrl}/mobile/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverId: driverId.trim() }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка авторизации');
  }

  const data = await res.json();
  const driver: Driver = { driverId: data.driverId, fio: data.fio, token: data.token };

  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  await SecureStore.setItemAsync(DRIVER_KEY, JSON.stringify(driver));

  return driver;
}

/** Получить сохранённого водителя */
export async function getSavedDriver(): Promise<Driver | null> {
  const raw = await SecureStore.getItemAsync(DRIVER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Выход */
export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(DRIVER_KEY);
}

/** GET баланс */
export async function fetchBalance(token: string) {
  const baseUrl = await getServerUrl();
  const res = await fetch(`${baseUrl}/mobile/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Ошибка загрузки баланса');
  return res.json();
}

/** GET история чата */
export async function fetchChatHistory(token: string, channel: number) {
  const baseUrl = await getServerUrl();
  const res = await fetch(`${baseUrl}/mobile/chat/${channel}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Ошибка загрузки чата');
  return res.json();
}

export interface RepairRequestItem {
  id: string;
  carInfo: string;
  text: string;
  status: number;
  statusName: string;
  adminComment: string;
  createdAt: string;
  updatedAt?: string;
}

/** GET заявки на ремонт водителя */
export async function fetchRepairs(token: string): Promise<RepairRequestItem[]> {
  const baseUrl = await getServerUrl();
  const res = await fetch(`${baseUrl}/mobile/repairs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Ошибка загрузки заявок на ремонт');
  return res.json();
}

/** POST создание заявки на ремонт */
export async function createRepairRequest(token: string, text: string): Promise<RepairRequestItem> {
  const baseUrl = await getServerUrl();
  const res = await fetch(`${baseUrl}/mobile/repairs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка отправки заявки');
  }
  return res.json();
}

export interface AppUpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  downloadUrl: string;
}

export const CURRENT_APP_VERSION = '1.0.7';

/** Проверка доступности обновления на сервере */
export async function checkAppUpdate(): Promise<AppUpdateInfo | null> {
  try {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/mobile/version`);
    if (!res.ok) return null;
    const data = await res.json();
    const latest = data.version || CURRENT_APP_VERSION;
    const downloadUrl = data.downloadUrl?.startsWith('http')
      ? data.downloadUrl
      : `${baseUrl}${data.downloadUrl || '/download-apk'}`;

    return {
      hasUpdate: latest !== CURRENT_APP_VERSION,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: latest,
      changelog: data.changelog || '',
      downloadUrl,
    };
  } catch {
    return null;
  }
}
