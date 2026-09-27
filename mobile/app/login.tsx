import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { loginWithDriverId, getSavedDriver, getServerUrl, setServerUrl } from '../services/api';

export default function LoginScreen() {
  const [driverId, setDriverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [serverUrl, setServerState] = useState('');
  const [editServer, setEditServer] = useState(false);
  const [newServerInput, setNewServerInput] = useState('');

  // При открытии — проверяем сохранённый токен
  useEffect(() => {
    getServerUrl().then(url => {
      setServerState(url);
      setNewServerInput(url);
    });
    getSavedDriver().then(driver => {
      if (driver) router.replace('/(tabs)/balance');
    }).finally(() => setChecking(false));
  }, []);

  const handleLogin = async () => {
    if (!driverId.trim()) {
      Alert.alert('Ошибка', 'Введите код доступа (ID водителя)');
      return;
    }
    setLoading(true);
    try {
      await loginWithDriverId(driverId.trim());
      router.replace('/(tabs)/balance');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Неверный код доступа');
    } finally {
      setLoading(false);
    }
  };

  const saveServer = async () => {
    const trimmed = newServerInput.trim().replace(/\/+$/, '');
    if (!trimmed) return;
    await setServerUrl(trimmed);
    setServerState(trimmed);
    setEditServer(false);
    Alert.alert('Сервер сохранён', trimmed);
  };

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3273dc" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>🚗 LUNA</Text>
        <Text style={styles.subtitle}>Портал водителя</Text>

        <TextInput
          style={styles.input}
          placeholder="Код доступа (ID водителя)"
          value={driverId}
          onChangeText={setDriverId}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Войти</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>
          Код доступа выдаётся администратором
        </Text>

        <View style={styles.serverRow}>
          {editServer ? (
            <View style={{ width: '100%', marginTop: 8 }}>
              <TextInput
                style={[styles.input, { fontSize: 13, padding: 8, marginBottom: 6 }]}
                value={newServerInput}
                onChangeText={setNewServerInput}
                autoCapitalize="none"
                placeholder="https://t196driveboss.ru"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <TouchableOpacity style={[styles.miniButton, { backgroundColor: '#3273dc' }]} onPress={saveServer}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Сохранить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.miniButton, { backgroundColor: '#dbdbdb' }]} onPress={() => setEditServer(false)}>
                  <Text style={{ color: '#333', fontSize: 12 }}>Отмена</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditServer(true)} style={{ marginTop: 14 }}>
              <Text style={styles.serverText}>🌐 {serverUrl || 'https://t196driveboss.ru'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#3273dc', justifyContent: 'center', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 28, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  logo: { fontSize: 40, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#363636', marginBottom: 24 },
  input: { borderWidth: 1.5, borderColor: '#dbdbdb', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 14, color: '#363636' },
  button: { backgroundColor: '#3273dc', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { textAlign: 'center', color: '#999', fontSize: 12 },
  serverRow: { alignItems: 'center' },
  serverText: { color: '#888', fontSize: 11, textDecorationLine: 'underline' },
  miniButton: { borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
});
