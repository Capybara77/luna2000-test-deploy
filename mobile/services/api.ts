import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'luna_token';
const DRIVER_KEY = 'luna_driver';
const SERVER_URL_KEY = 'luna_server_url';
const BALANCE_CACHE_KEY = 'luna_cached_balance';

export async function getCachedBalance(): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(BALANCE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedBalance(data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(BALANCE_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

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

/** GET баланс (с авто-кэшированием) */
export async function fetchBalance(token: string) {
  const baseUrl = await getServerUrl();
  const res = await fetch(`${baseUrl}/mobile/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Ошибка загрузки баланса');
  const data = await res.json();
  await setCachedBalance(data);
  return data;
}

export interface CarDetails {
  hasCar: boolean;
  id?: string;
  brandModel?: string;
  plateNumber?: string;
  vin?: string;
  year?: string;
  sts?: string;
  pts?: string;
  osago?: string;
  kasko?: string;
  techInspection?: string;
  taxiLicense?: boolean;
  dailyRent?: number;
}

/** GET данные привязанного автомобиля водителя */
export async function fetchMyCar(token: string): Promise<CarDetails> {
  const baseUrl = await getServerUrl();
  const res = await fetch(`${baseUrl}/mobile/car`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Ошибка загрузки автомобиля');
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
  photoUrl?: string;
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

/** POST создание заявки на ремонт (с поддержкой фото) */
export async function createRepairRequest(
  token: string,
  text: string,
  photoBase64?: string
): Promise<RepairRequestItem> {
  const baseUrl = await getServerUrl();
  const res = await fetch(`${baseUrl}/mobile/repairs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text: text.trim(),
      photoBase64: photoBase64 || null,
    }),
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

export const CURRENT_APP_VERSION = '1.0.9';

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
