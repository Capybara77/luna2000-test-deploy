import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration } from 'react-native';

export interface NotificationSettings {
  notifyChat: boolean;
  notifyTopup: boolean;
  notifyRent: boolean;
  vibration: boolean;
}

const SETTINGS_KEY = 'luna_notification_settings';
const LAST_BALANCE_KEY = 'luna_last_known_balance';

const defaultSettings: NotificationSettings = {
  notifyChat: true,
  notifyTopup: true,
  notifyRent: true,
  vibration: true,
};

let cachedSettings: NotificationSettings = { ...defaultSettings };
let settingsLoaded = false;

export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (settingsLoaded) return cachedSettings;
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      cachedSettings = { ...defaultSettings, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load notification settings:', e);
  }
  settingsLoaded = true;
  return cachedSettings;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  cachedSettings = { ...settings };
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save notification settings:', e);
  }
}

export type NotificationType = 'chat' | 'topup' | 'rent';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: number;
}

type NotificationListener = (notif: AppNotification) => void;
const listeners: Set<NotificationListener> = new Set();

export function onAppNotification(listener: NotificationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function notify(type: NotificationType, title: string, message: string) {
  const settings = await getNotificationSettings();

  if (type === 'chat' && !settings.notifyChat) return;
  if (type === 'topup' && !settings.notifyTopup) return;
  if (type === 'rent' && !settings.notifyRent) return;

  if (settings.vibration) {
    try {
      Vibration.vibrate(200);
    } catch {}
  }

  const notif: AppNotification = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    type,
    title,
    message,
    createdAt: Date.now(),
  };

  listeners.forEach(fn => fn(notif));
}

/** Проверка изменения баланса для вызова уведомлений */
export async function checkBalanceChange(currentBalance: number) {
  try {
    const raw = await AsyncStorage.getItem(LAST_BALANCE_KEY);
    await AsyncStorage.setItem(LAST_BALANCE_KEY, currentBalance.toString());

    if (raw !== null) {
      const prevBalance = parseFloat(raw);
      if (!isNaN(prevBalance)) {
        const diff = currentBalance - prevBalance;
        if (diff > 0) {
          await notify('topup', '💳 Пополнение баланса', `Зачислено: +${diff.toLocaleString('ru-RU')} ₽ (Баланс: ${currentBalance.toLocaleString('ru-RU')} ₽)`);
        } else if (diff < 0) {
          await notify('rent', '📉 Списание с баланса', `Списано: ${Math.abs(diff).toLocaleString('ru-RU')} ₽ (Баланс: ${currentBalance.toLocaleString('ru-RU')} ₽)`);
        }
      }
    }
  } catch (e) {
    console.warn('checkBalanceChange error:', e);
  }
}
