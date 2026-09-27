import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { getSavedDriver, logout, checkAppUpdate, CURRENT_APP_VERSION, AppUpdateInfo } from '../../services/api';
import { API_BASE_URL } from '../../config';

export default function ProfileScreen() {
  const [driver, setDriver] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    getSavedDriver().then(setDriver);
    checkAppUpdate().then(setUpdateInfo);
  }, []);

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

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(driver?.fio || 'Водитель').split(' ').slice(0, 2).map((p: string) => p[0] || '').join('')}
          </Text>
        </View>
        <Text style={styles.name}>{driver?.fio || '...'}</Text>
        <Text style={styles.role}>🚗 Водитель</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>ID водителя</Text>
        <Text style={styles.infoValue} selectable>{driver?.driverId}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Сервер</Text>
        <Text style={styles.infoValue}>{API_BASE_URL}</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.infoLabel}>Версия приложения</Text>
            <Text style={styles.infoValue}>v{CURRENT_APP_VERSION}</Text>
          </View>
          <TouchableOpacity style={styles.checkUpdateBtn} onPress={handleCheckUpdate} disabled={checkingUpdate}>
            <Text style={styles.checkUpdateText}>{checkingUpdate ? 'Проверка...' : 'Проверить'}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3273dc', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700', color: '#363636' },
  role: { color: '#999', marginTop: 4 },
  infoCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8 },
  infoLabel: { fontSize: 11, color: '#aaa', marginBottom: 3 },
  infoValue: { fontSize: 14, color: '#363636', fontFamily: 'monospace' },
  logoutBtn: { marginTop: 24, backgroundColor: '#fff5f7', borderRadius: 10, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f14668' },
  logoutText: { color: '#f14668', fontWeight: '700', fontSize: 16 },
  checkUpdateBtn: { backgroundColor: '#f0f4fc', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  checkUpdateText: { color: '#3273dc', fontWeight: '600', fontSize: 13 },
  updateAvailableBanner: { marginTop: 12, backgroundColor: '#eef9f2', borderWidth: 1, borderColor: '#48c774', borderRadius: 8, padding: 12 },
  updateBannerTitle: { fontWeight: '700', color: '#257942', fontSize: 14 },
  updateBannerDesc: { fontSize: 12, color: '#363636', marginTop: 4 },
  updateBannerAction: { fontWeight: '700', color: '#3273dc', marginTop: 8, fontSize: 13 },
});
