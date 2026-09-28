import { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { ThemeProvider, useAppTheme } from '../services/themeContext';
import { checkAppUpdate, AppUpdateInfo } from '../services/api';

function RootNav() {
  const { theme, isDark } = useAppTheme();
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // Тихо проверяем обновления при старте приложения
    checkAppUpdate().then((info) => {
      if (info?.hasUpdate) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      }
    }).catch(() => {});
  }, []);

  return (
    <>
      <Stack screenOptions={{
        headerStyle: { backgroundColor: theme.headerBg },
        headerTintColor: theme.headerText,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: theme.background },
      }}>
        <Stack.Screen name="login" options={{ title: 'Вход', headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>

      {/* Модальное окно авто-обновления */}
      {updateInfo && (
        <Modal
          visible={showUpdateModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUpdateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalIcon}>🚀</Text>
                <Text style={[styles.modalTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  Доступно обновление
                </Text>
                <View style={styles.versionBadge}>
                  <Text style={styles.versionBadgeText}>v{updateInfo.version || 'новое'}</Text>
                </View>
              </View>

              {!!updateInfo.changelog && (
                <View style={[styles.changelogBox, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
                  <Text style={[styles.changelogLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    Что нового:
                  </Text>
                  <Text style={[styles.changelogText, { color: isDark ? '#e2e8f0' : '#1e293b' }]}>
                    {updateInfo.changelog}
                  </Text>
                </View>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
                  onPress={() => setShowUpdateModal(false)}
                >
                  <Text style={[styles.btnCancelText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                    Позже
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnUpdate]}
                  onPress={() => {
                    setShowUpdateModal(false);
                    if (updateInfo.downloadUrl) {
                      Linking.openURL(updateInfo.downloadUrl);
                    }
                  }}
                >
                  <Text style={styles.btnUpdateText}>Обновить</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNav />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  versionBadge: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  versionBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  changelogBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  changelogLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  changelogText: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {},
  btnCancelText: {
    fontWeight: '700',
    fontSize: 14,
  },
  btnUpdate: {
    backgroundColor: '#2563eb',
  },
  btnUpdateText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
