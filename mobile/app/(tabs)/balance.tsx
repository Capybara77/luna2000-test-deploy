import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { getSavedDriver, fetchBalance } from '../../services/api';

interface Operation {
  type: string;
  note: string;
  createdAt: string;
  isDebit: boolean;
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const s = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${day}.${month}.${d.getFullYear()} ${hours}:${minutes}`;
  } catch {
    return '';
  }
}

import { checkBalanceChange } from '../../services/notificationService';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '../../services/themeContext';

export default function BalanceScreen() {
  const { theme, isDark } = useAppTheme();
  const [driver, setDriver] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const saved = await getSavedDriver();
      if (!saved) return;
      setDriver(saved);
      const data = await fetchBalance(saved.token);
      setBalance(data.balance);
      setOperations(data.operations || []);
      if (typeof data.balance === 'number') {
        checkBalanceChange(data.balance);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const balanceColor = balance === null ? '#999' : balance > 0 ? '#48c774' : balance < 0 ? '#f14668' : '#999';
  const balanceStatus = balance === null ? '' : balance < 0 ? '⚠ Пополните баланс!' : balance < 1500 ? '⚠ Баланс низкий' : '✓ Баланс в норме';
  const statusColor = balance !== null && balance < 0 ? '#f14668' : balance !== null && balance < 1500 ? '#ffdd57' : '#48c774';

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3273dc" /></View>;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      {/* Приветствие */}
      <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
        <Text style={styles.greeting}>👋 Добро пожаловать,</Text>
        <Text style={styles.name}>{driver?.fio}</Text>
      </View>

      {/* Баланс */}
      <View style={[styles.balanceCard, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderTopColor: balanceColor, borderTopWidth: 4 }]}>
        <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>Текущий баланс</Text>
        <Text style={[styles.balanceValue, { color: balanceColor }]}>
          ₽ {balance?.toLocaleString('ru', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={[styles.balanceStatus, { color: statusColor }]}>{balanceStatus}</Text>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: isDark ? '#3b1c24' : '#fff5f7' }]}>
          <Text style={styles.errorText}>⚠ {error}</Text>
          <TouchableOpacity onPress={load}><Text style={[styles.retryText, { color: theme.primary }]}>Повторить</Text></TouchableOpacity>
        </View>
      )}

      {/* История операций */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>История операций</Text>
        {operations.length === 0
          ? <Text style={[styles.empty, { color: theme.textMuted }]}>Операций нет</Text>
          : operations.map((op, i) => (
            <View key={i} style={[styles.opRow, { backgroundColor: isDark ? (op.isDebit ? '#2a151d' : '#102d1d') : (op.isDebit ? '#fff5f7' : '#f0fff4'), borderColor: theme.border, borderWidth: 1 }]}>
              <Text style={styles.opIcon}>{op.isDebit ? '🔻' : '🟢'}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <Text style={[styles.opTitle, { color: op.isDebit ? '#f87171' : '#4ade80' }]}>{op.type}</Text>
                  <Text style={[styles.opTime, { color: theme.textMuted }]}>{formatDateTime(op.createdAt)}</Text>
                </View>
                <Text style={[styles.opNote, { color: theme.text }]}>{op.note}</Text>
              </View>
            </View>
          ))
        }
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#3273dc', padding: 20, paddingTop: 24 },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  balanceCard: { margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', borderTopWidth: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  balanceLabel: { color: '#999', fontSize: 13, marginBottom: 6 },
  balanceValue: { fontSize: 42, fontWeight: '800' },
  balanceStatus: { fontSize: 13, marginTop: 8, fontWeight: '600' },
  section: { margin: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#363636', marginBottom: 10 },
  opRow: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 8, marginBottom: 6, alignItems: 'flex-start' },
  opIcon: { fontSize: 18, marginTop: 1 },
  opTitle: { fontSize: 13, fontWeight: '700' },
  opNote: { fontSize: 12, color: '#4a4a4a', lineHeight: 17, marginTop: 2 },
  opTime: { fontSize: 11, color: '#888' },
  empty: { color: '#999', textAlign: 'center', padding: 20 },
  errorBox: { margin: 16, backgroundColor: '#fff5f7', padding: 14, borderRadius: 8, alignItems: 'center' },
  errorText: { color: '#f14668', marginBottom: 6 },
  retryText: { color: '#3273dc', fontWeight: '600' },
});
