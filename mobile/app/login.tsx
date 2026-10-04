import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import { loginWithDriverId, getSavedDriver, getServerUrl, setServerUrl } from '../services/api';

export default function LoginScreen() {
  const [driverId, setDriverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [serverUrl, setServerState] = useState('');
  const [editServer, setEditServer] = useState(false);
  const [newServerInput, setNewServerInput] = useState('');

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
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Deep navy gradient background */}
      <View style={styles.bgBase}>
        {/* Top accent blob */}
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      <View style={styles.card}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
          {/* Glow ring */}
          <View style={styles.logoGlow} />
        </View>

        <Text style={styles.logoTitle}>LUNA 2000</Text>
        <Text style={styles.subtitle}>Портал водителя</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Input */}
        <Text style={styles.inputLabel}>КОД ДОСТУПА</Text>
        <TextInput
          style={styles.input}
          placeholder="Введите ID водителя"
          placeholderTextColor="#334155"
          value={driverId}
          onChangeText={setDriverId}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleLogin}
          keyboardType="number-pad"
          selectionColor="#3b82f6"
        />

        {/* Login button */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Войти →</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>Код доступа выдаётся администратором</Text>

        {/* Server URL */}
        <View style={styles.serverRow}>
          {editServer ? (
            <View style={{ width: '100%', marginTop: 8 }}>
              <TextInput
                style={[styles.input, { fontSize: 12, paddingVertical: 10, marginBottom: 6 }]}
                value={newServerInput}
                onChangeText={setNewServerInput}
                autoCapitalize="none"
                placeholder="https://t196driveboss.ru"
                placeholderTextColor="#334155"
                selectionColor="#3b82f6"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <TouchableOpacity style={styles.miniButtonPrimary} onPress={saveServer}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Сохранить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.miniButtonGhost} onPress={() => setEditServer(false)}>
                  <Text style={{ color: '#64748b', fontSize: 12 }}>Отмена</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#070d1a',
    justifyContent: 'center',
    padding: 24,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#070d1a' },

  // Background decorations
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070d1a',
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(29, 78, 216, 0.12)',
  },
  blob2: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(59, 130, 246, 0.07)',
  },

  // Card — glassmorphism
  card: {
    backgroundColor: 'rgba(13, 31, 60, 0.85)',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },

  // Logo
  logoWrap: {
    alignSelf: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1e3a5f',
  },
  logoGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },

  logoTitle: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    color: '#f0f6ff',
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    color: '#64748b',
    marginBottom: 20,
    letterSpacing: 0.3,
  },

  divider: {
    height: 1,
    backgroundColor: '#1e3a5f',
    marginBottom: 20,
  },

  inputLabel: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0a1628',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#f0f6ff',
    marginBottom: 14,
  },

  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  hint: { textAlign: 'center', color: '#334155', fontSize: 11 },

  serverRow: { alignItems: 'center' },
  serverText: { color: '#1e3a5f', fontSize: 11, textDecorationLine: 'underline' },

  miniButtonPrimary: {
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#1d4ed8',
  },
  miniButtonGhost: {
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
});
