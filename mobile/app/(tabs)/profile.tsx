import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Linking, Switch } from 'react-native';
import { router } from 'expo-router';
import { getSavedDriver, logout, checkAppUpdate, AppUpdateInfo, CURRENT_APP_VERSION } from '../../services/api';
import { API_BASE_URL } from '../../config';
import { getNotificationSettings, saveNotificationSettings, NotificationSettings } from '../../services/notificationService';
import { useAppTheme } from '../../services/themeContext';

export default function ProfileScreen() {
  const [driver, setDriver] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    notifyChat: true,
    notifyTopup: true,
    notifyRent: true,
    vibration: true,
  });

  const { isDark, setDark, theme } = useAppTheme();

  useEffect(() => {
    getSavedDriver().then(setDriver);
    getNotificationSettings().then(setNotifSettings);
  }, []);

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    const updated = { ...notifSettings, [key]: value };
    setNotifSettings(updated);
    await saveNotificationSettings(updated);
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    const info = await checkAppUpdate();
    setUpdateInfo(info);
    setCheckingUpdate(false);
    if (!info?.hasUpdate) {
      Alert.alert('Обновления', `У вас установлена актуальная версия v${CURRENT_APP_VERSION}`);
    }
  };

  const handleDownloadUpdate = () => {
    if (updateInfo?.downloadUrl) {
      Linking.openURL(updateInfo.downloadUrl);
    }
  };

  const handleLogout = () => {
    Alert.alert('Выход', 'Выйти из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/login');
        }
      }
    ]);
  };

  const dynamicStyles = {
    container: { backgroundColor: theme.background },
    card: { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
    name: { color: theme.text },
    role: { color: theme.textMuted },
    infoCard: { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
    infoLabel: { color: theme.textMuted },
    infoValue: { color: theme.text },
    settingsCard: { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
    settingsHeader: { color: theme.text },
    settingTitle: { color: theme.text },
    settingSubtitle: { color: theme.textMuted },
    settingDivider: { backgroundColor: theme.border },
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={[styles.card, dynamicStyles.card]}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>
            {(driver?.fio || 'Водитель').split(' ').slice(0, 2).map((p: string) => p[0] || '').join('')}
          </Text>
        </View>
        <Text style={[styles.name, dynamicStyles.name]}>{driver?.fio || '...'}</Text>
        <Text style={[styles.role, dynamicStyles.role]}>🚗 Водитель</Text>
      </View>

      <View style={[styles.infoCard, dynamicStyles.infoCard]}>
        <Text style={[styles.infoLabel, dynamicStyles.infoLabel]}>ID водителя</Text>
        <Text style={[styles.infoValue, dynamicStyles.infoValue]} selectable>{driver?.driverId}</Text>
      </View>

      <View style={[styles.infoCard, dynamicStyles.infoCard]}>
        <Text style={[styles.infoLabel, dynamicStyles.infoLabel]}>Сервер</Text>
        <Text style={[styles.infoValue, dynamicStyles.infoValue]}>{API_BASE_URL}</Text>
      </View>

      {/* Настройки темы оформления */}
      <View style={[styles.settingsCard, dynamicStyles.settingsCard]}>
        <Text style={[styles.settingsHeader, dynamicStyles.settingsHeader]}>🎨 Оформление</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={[styles.settingTitle, dynamicStyles.settingTitle]}>🌙 Темная тема</Text>
            <Text style={[styles.settingSubtitle, dynamicStyles.settingSubtitle]}>Комфортный темный интерфейс для ночи</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={setDark}
            trackColor={{ false: '#ddd', true: '#60a5fa' }}
            thumbColor={isDark ? theme.primary : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Настройки уведомлений */}
      <View style={[styles.settingsCard, dynamicStyles.settingsCard]}>
        <Text style={[styles.settingsHeader, dynamicStyles.settingsHeader]}>🔔 Уведомления</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={[styles.settingTitle, dynamicStyles.settingTitle]}>💬 Сообщения в чате</Text>
            <Text style={[styles.settingSubtitle, dynamicStyles.settingSubtitle]}>Уведомления о новых сообщениях</Text>
          </View>
          <Switch
            value={notifSettings.notifyChat}
            onValueChange={(v) => updateSetting('notifyChat', v)}
            trackColor={{ false: '#ddd', true: '#b8d5ff' }}
            thumbColor={notifSettings.notifyChat ? theme.primary : '#f4f3f4'}
          />
        </View>

        <View style={[styles.settingDivider, dynamicStyles.settingDivider]} />

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={[styles.settingTitle, dynamicStyles.settingTitle]}>💳 Пополнение баланса</Text>
            <Text style={[styles.settingSubtitle, dynamicStyles.settingSubtitle]}>Уведомления о зачислении средств</Text>
          </View>
          <Switch
            value={notifSettings.notifyTopup}
            onValueChange={(v) => updateSetting('notifyTopup', v)}
            trackColor={{ false: '#ddd', true: '#b8d5ff' }}
            thumbColor={notifSettings.notifyTopup ? theme.primary : '#f4f3f4'}
          />
        </View>

        <View style={[styles.settingDivider, dynamicStyles.settingDivider]} />

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={[styles.settingTitle, dynamicStyles.settingTitle]}>📉 Списание аренды</Text>
            <Text style={[styles.settingSubtitle, dynamicStyles.settingSubtitle]}>Уведомления о ежедневных списаниях</Text>
          </View>
          <Switch
            value={notifSettings.notifyRent}
            onValueChange={(v) => updateSetting('notifyRent', v)}
            trackColor={{ false: '#ddd', true: '#b8d5ff' }}
            thumbColor={notifSettings.notifyRent ? theme.primary : '#f4f3f4'}
          />
        </View>

        <View style={[styles.settingDivider, dynamicStyles.settingDivider]} />

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={[styles.settingTitle, dynamicStyles.settingTitle]}>📳 Вибрация</Text>
            <Text style={[styles.settingSubtitle, dynamicStyles.settingSubtitle]}>Виброотклик при получении уведомления</Text>
          </View>
          <Switch
            value={notifSettings.vibration}
            onValueChange={(v) => updateSetting('vibration', v)}
            trackColor={{ false: '#ddd', true: '#b8d5ff' }}
            thumbColor={notifSettings.vibration ? theme.primary : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={[styles.infoCard, dynamicStyles.infoCard]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={[styles.infoLabel, dynamicStyles.infoLabel]}>Версия приложения</Text>
            <Text style={[styles.infoValue, dynamicStyles.infoValue]}>v{CURRENT_APP_VERSION}</Text>
          </View>
          <TouchableOpacity style={[styles.checkUpdateBtn, { backgroundColor: isDark ? '#1e3a8a' : '#f0f4fc' }]} onPress={handleCheckUpdate} disabled={checkingUpdate}>
            <Text style={[styles.checkUpdateText, { color: isDark ? '#93c5fd' : '#3273dc' }]}>{checkingUpdate ? 'Проверка...' : 'Проверить'}</Text>
          </TouchableOpacity>
        </View>
        {updateInfo?.hasUpdate && (
          <TouchableOpacity style={styles.updateAvailableBanner} onPress={handleDownloadUpdate}>
            <Text style={styles.updateBannerTitle}>🎉 Доступно обновление: v{updateInfo.latestVersion}</Text>
            <Text style={styles.updateBannerDesc}>{updateInfo.changelog || 'Нажмите, чтобы скачать и установить поверх'}</Text>
            <Text style={styles.updateBannerAction}>Скачать и обновить ➔</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700' },
  role: { marginTop: 4 },
  infoCard: { borderRadius: 10, padding: 14, marginBottom: 8 },
  infoLabel: { fontSize: 11, marginBottom: 3 },
  infoValue: { fontSize: 14, fontFamily: 'monospace' },
  settingsCard: { borderRadius: 10, padding: 16, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  settingsHeader: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  settingTextCol: { flex: 1, paddingRight: 10 },
  settingTitle: { fontSize: 14, fontWeight: '600' },
  settingSubtitle: { fontSize: 11, marginTop: 2 },
  settingDivider: { height: 1, marginVertical: 8 },
  logoutBtn: { marginTop: 16, backgroundColor: '#fff5f7', borderRadius: 10, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f14668' },
  logoutText: { color: '#f14668', fontWeight: '700', fontSize: 16 },
  checkUpdateBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  checkUpdateText: { fontWeight: '600', fontSize: 13 },
  updateAvailableBanner: { marginTop: 12, backgroundColor: '#eef9f2', borderWidth: 1, borderColor: '#48c774', borderRadius: 8, padding: 12 },
  updateBannerTitle: { fontWeight: '700', color: '#257942', fontSize: 14 },
  updateBannerDesc: { fontSize: 12, color: '#363636', marginTop: 4 },
  updateBannerAction: { fontWeight: '700', color: '#3273dc', marginTop: 8, fontSize: 13 },
});
