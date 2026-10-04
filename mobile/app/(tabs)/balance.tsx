import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSavedDriver, fetchBalance, getCachedBalance } from '../../services/api';
import { checkBalanceChange } from '../../services/notificationService';
import { useAppTheme } from '../../services/themeContext';

interface Operation {
  type: string;
  note: string;
  createdAt: string;
  isDebit: boolean;
}

interface AssignedCar {
  brandModel: string;
  plateNumber: string;
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

const HIDE_BALANCE_KEY = 'luna_hide_balance';

export default function BalanceScreen() {
  const { theme, isDark } = useAppTheme();
  const [driver, setDriver] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [car, setCar] = useState<AssignedCar | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_BALANCE_KEY).then((val) => {
      if (val === 'true') setHideBalance(true);
    });
  }, []);

  const toggleHideBalance = async () => {
    const next = !hideBalance;
    setHideBalance(next);
    await AsyncStorage.setItem(HIDE_BALANCE_KEY, next ? 'true' : 'false');
  };

  const load = useCallback(async () => {
    const saved = await getSavedDriver();
    if (!saved) return;
    setDriver(saved);

    try {
      setError(null);
      const data = await fetchBalance(saved.token);
      setBalance(data.balance);
      setOperations(data.operations || []);
      setCar(data.car || null);
      setIsOffline(false);
      if (typeof data.balance === 'number') {
        checkBalanceChange(data.balance);
      }
    } catch (e: any) {
      // Пытаемся взять данные из кэша
      const cached = await getCachedBalance();
      if (cached) {
        setBalance(cached.balance);
        setOperations(cached.operations || []);
        setCar(cached.car || null);
        setIsOffline(true);
      } else {
        setError(e.message || 'Ошибка сети');
      }
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

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

  const balanceColor = balance === null ? '#94a3b8' : balance > 0 ? '#22c55e' : balance < 0 ? '#ef4444' : '#94a3b8';
  const balanceStatus = balance === null ? '' : balance < 0 ? '⚠ Пополните баланс' : balance < 1500 ? '⚠ Баланс низкий' : '✓ Баланс в норме';
  const statusBg = balance !== null && balance < 0 ? 'rgba(239, 68, 68, 0.15)' : balance !== null && balance < 1500 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)';
  const statusColor = balance !== null && balance < 0 ? '#ef4444' : balance !== null && balance < 1500 ? '#eab308' : '#22c55e';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      {/* Приветствие */}
      <View style={[styles.header, { backgroundColor: isDark ? '#070d1a' : '#2563eb' }]}>
        {/* Subtle glow blob behind header — only in dark mode */}
        {isDark && <View style={styles.headerGlow} />}
        <Text style={styles.greeting}>👋 Добро пожаловать,</Text>
        <Text style={styles.name}>{driver?.fio || 'Водитель'}</Text>
      </View>

      {/* Офлайн баннер */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📡 Офлайн-режим • Показаны сохранённые данные</Text>
        </View>
      )}

      {/* Стильная карта-баланс */}
      <View style={styles.cardWrapper}>
        <View style={styles.bankCard}>
          {/* Верхняя строка карты */}
          <View style={styles.cardTopRow}>
            <View style={styles.chipRow}>
              <Text style={styles.chipText}>💳 LUNA FLEET</Text>
            </View>
            <TouchableOpacity onPress={toggleHideBalance} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{hideBalance ? '🙈' : '👁️'}</Text>
              <Text style={styles.eyeText}>{hideBalance ? 'Показать' : 'Скрыть'}</Text>
            </TouchableOpacity>
          </View>

          {/* Значение баланса */}
          <Text style={styles.balanceLabel}>Текущий баланс</Text>
          <Text style={[styles.balanceValue, { color: balanceColor }]}>
            {hideBalance
              ? '•••••• ₽'
              : `${balance !== null ? balance.toLocaleString('ru', { minimumFractionDigits: 2 }) : '0.00'} ₽`}
          </Text>

          {/* Статус бейдж */}
          <View style={[styles.statusBadge, { backgroundColor: statusBg, alignSelf: 'flex-start' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{balanceStatus}</Text>
          </View>

          {/* Нижняя строка карты с авто и водителем */}
          <View style={styles.cardBottomRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardDriverLabel}>ВОДИТЕЛЬ</Text>
              <Text style={styles.cardDriverName} numberOfLines={1}>{driver?.fio || '—'}</Text>
            </View>
            {car && (
              <View style={styles.carBadge}>
                <Text style={styles.carBadgeText}>🚗 {car.brandModel}</Text>
                <Text style={styles.plateText}>{car.plateNumber}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {error && !isOffline && (
        <View style={[styles.errorBox, { backgroundColor: isDark ? '#3b1c24' : '#fff5f7' }]}>
          <Text style={styles.errorText}>⚠ {error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={[styles.retryText, { color: theme.primary }]}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* История операций */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>История операций</Text>
        {operations.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>Операций пока нет</Text>
        ) : (
          operations.map((op, i) => (
            <View
              key={i}
              style={[
                styles.opRow,
                {
                  backgroundColor: isDark
                    ? op.isDebit ? '#261318' : '#0e2417'
                    : op.isDebit ? '#fef2f2' : '#f0fdf4',
                  borderColor: isDark
                    ? op.isDebit ? '#7f1d1d' : '#14532d'
                    : op.isDebit ? '#fecaca' : '#bbf7d0',
                },
              ]}
            >
              <Text style={styles.opIcon}>{op.isDebit ? '🔻' : '🟢'}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.opTitle, { color: op.isDebit ? '#ef4444' : '#16a34a' }]}>{op.type}</Text>
                  <Text style={[styles.opTime, { color: theme.textMuted }]}>{formatDateTime(op.createdAt)}</Text>
                </View>
                <Text style={[styles.opNote, { color: isDark ? '#e2e8f0' : '#1f2937' }]}>{op.note}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 24, overflow: 'hidden', position: 'relative' },
  headerGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(29, 78, 216, 0.15)',
  },
  greeting: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  name: { color: '#ffffff', fontSize: 22, fontWeight: '800', marginTop: 2 },

  offlineBanner: {
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  cardWrapper: {
    margin: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  bankCard: {
    backgroundColor: '#0b1530',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chipRow: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  eyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  eyeIcon: {
    fontSize: 14,
  },
  eyeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },

  balanceLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },

  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12,
    gap: 12,
  },
  cardDriverLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardDriverName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  carBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  carBadgeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  plateText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
    letterSpacing: 0.5,
  },

  section: { margin: 16, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  opRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
    borderWidth: 1,
  },
  opIcon: { fontSize: 18, marginTop: 1 },
  opTitle: { fontSize: 13, fontWeight: '700' },
  opNote: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  opTime: { fontSize: 11 },
  empty: { textAlign: 'center', padding: 20, fontSize: 13 },
  errorBox: { margin: 16, padding: 14, borderRadius: 10, alignItems: 'center' },
  errorText: { color: '#ef4444', marginBottom: 6, fontWeight: '600' },
  retryText: { fontWeight: '700' },
});
