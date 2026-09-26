import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { loginWithDriverId, getSavedDriver } from '../services/api';

export default function LoginScreen() {
  const [driverId, setDriverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // При открытии — проверяем сохранённый токен
  useEffect(() => {
    getSavedDriver().then(driver => {
      if (driver) router.replace('/(tabs)/balance');
    }).finally(() => setChecking(false));
  }, []);

  const handleLogin = async () => {
    if (!driverId.trim()) {
      Alert.alert('Ошибка', 'Введите код доступа');
      return;
    }
    setLoading(true);
    try {
      await loginWithDriverId(driverId.trim());
      router.replace('/(tabs)/balance');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#3273dc', justifyContent: 'center', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 28, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  logo: { fontSize: 40, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#363636', marginBottom: 28 },
  input: { borderWidth: 1.5, borderColor: '#dbdbdb', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 14, color: '#363636' },
  button: { backgroundColor: '#3273dc', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { textAlign: 'center', color: '#999', fontSize: 12 },
});
