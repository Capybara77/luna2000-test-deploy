import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { getSavedDriver, logout } from '../../services/api';
import { API_BASE_URL } from '../../config';

export default function ProfileScreen() {
  const [driver, setDriver] = useState<any>(null);

  useEffect(() => {
    getSavedDriver().then(setDriver);
  }, []);

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
});
