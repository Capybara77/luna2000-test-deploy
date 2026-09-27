// Настройки подключения к серверу
// Поменяй IP на реальный адрес твоего компьютера в локальной сети

export const API_BASE_URL = 'https://t196driveboss.ru';
export const SIGNALR_HUB_URL = `${API_BASE_URL}/mobile/chathub`;

export const CHANNEL_NAMES: Record<number, string> = {
  0: 'Общий',
  1: 'Где стоят',
  2: 'Барахолка',
};

export const CHANNEL_ICONS: Record<number, string> = {
  0: '💬',
  1: '📍',
  2: '🛒',
};
