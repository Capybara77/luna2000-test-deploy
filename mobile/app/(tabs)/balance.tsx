import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Linking,
  Platform,
} from 'react-native';
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
  amount?: number | null;
}

interface AssignedCar {
  brandModel: string;
  plateNumber: string;
}

interface ContactPerson {
  role: string;
  phone: string;
  displayPhone: string;
  note?: string;
  icon: string;
}

export const PARK_CONTACTS: ContactPerson[] = [
  {
    role: 'Начальник',
    phone: '89617776992',
    displayPhone: '+7 (961) 777-69-92',
    icon: '👔',
  },
  {
    role: 'Механик',
    phone: '89002023337',
    displayPhone: '+7 (900) 202-33-37',
    icon: '🔧',
  },
  {
    role: 'Техподдержка',
    note: 'только по приложению',
    phone: '89995664114',
    displayPhone: '+7 (999) 566-41-14',
    icon: '📱',
  },
];

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

function parseOpAmount(op: Operation): number {
  if (typeof op.amount === 'number' && op.amount > 0) {
    return op.amount;
  }
  if (!op.note) return 0;
  const match = op.note.match(/(?:[—+-]\s*)?([0-9\s]+(?:[.,][0-9]{1,2})?)\s*(?:руб|₽)/i);
  if (match && match[1]) {
    const clean = match[1].replace(/\s+/g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  }
  return 0;
}

function isCurrentMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const s = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
    const d = new Date(s);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  } catch {
    return false;
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
  const [showContacts, setShowContacts] = useState(false);
  const [opFilter, setOpFilter] = useState<'all' | 'credit' | 'debit'>('all');

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

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  // Расчет месячной статистики
  const stats = useMemo(() => {
    const currentMonthOps = operations.filter((op) => isCurrentMonth(op.createdAt));
    const activeOps = currentMonthOps.length > 0 ? currentMonthOps : operations;
    const isAllTime = currentMonthOps.length === 0 && operations.length > 0;

    const income = activeOps
      .filter((op) => !op.isDebit)
      .reduce((sum, op) => sum + parseOpAmount(op), 0);

    const expense = activeOps
      .filter((op) => op.isDebit)
      .reduce((sum, op) => sum + parseOpAmount(op), 0);

    const monthNames = [
      'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
      'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
    ];
    const monthName = monthNames[new Date().getMonth()];
    const label = isAllTime ? 'За всё время' : `За ${monthName}`;

    return { income, expense, label };
  }, [operations]);

  // Фильтрация операций
  const filteredOperations = useMemo(() => {
    if (opFilter === 'credit') return operations.filter((op) => !op.isDebit);
    if (opFilter === 'debit') return operations.filter((op) => op.isDebit);
    return operations;
  }, [operations, opFilter]);

  const creditCount = useMemo(() => operations.filter((op) => !op.isDebit).length, [operations]);
  const debitCount = useMemo(() => operations.filter((op) => op.isDebit).length, [operations]);

  const balanceColor =
    balance === null ? '#94a3b8' : balance > 0 ? '#22c55e' : balance < 0 ? '#ef4444' : '#94a3b8';
  const balanceStatus =
    balance === null
      ? ''
      : balance < 0
      ? '⚠ Пополните баланс'
      : balance < 1500
      ? '⚠ Баланс низкий'
      : '✓ Баланс в норме';
  const statusBg =
    balance !== null && balance < 0
      ? 'rgba(239, 68, 68, 0.15)'
      : balance !== null && balance < 1500
      ? 'rgba(234, 179, 8, 0.15)'
      : 'rgba(34, 197, 94, 0.15)';
  const statusColor =
    balance !== null && balance < 0
      ? '#ef4444'
      : balance !== null && balance < 1500
      ? '#eab308'
      : '#22c55e';

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
      {/* Приветствие с кнопкой быстрой связи */}
      <View style={[styles.header, { backgroundColor: isDark ? '#070d1a' : '#2563eb' }]}>
        {isDark && <View style={styles.headerGlow} />}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.greeting}>👋 Добро пожаловать,</Text>
            <Text style={styles.name} numberOfLines={1}>{driver?.fio || 'Водитель'}</Text>
          </View>
          <TouchableOpacity
            style={styles.headerContactBtn}
            onPress={() => setShowContacts(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.headerContactIcon}>📞</Text>
            <Text style={styles.headerContactText}>Связь</Text>
          </TouchableOpacity>
        </View>
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

      {/* Месячная статистика (Пункт 6) */}
      <View style={[styles.statsCard, { backgroundColor: isDark ? '#0d1f3c' : '#ffffff', borderColor: theme.border }]}>
        <View style={styles.statsHeader}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>📊 Итоги ({stats.label})</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statCol, { backgroundColor: isDark ? '#0e2417' : '#f0fdf4', borderColor: isDark ? '#14532d' : '#bbf7d0' }]}>
            <Text style={styles.statLabel}>🟢 Пополнено</Text>
            <Text style={styles.statIncomeValue}>+{stats.income.toLocaleString('ru')} ₽</Text>
          </View>
          <View style={[styles.statCol, { backgroundColor: isDark ? '#261318' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fecaca' }]}>
            <Text style={styles.statLabel}>🔻 Списано</Text>
            <Text style={styles.statExpenseValue}>-{stats.expense.toLocaleString('ru')} ₽</Text>
          </View>
        </View>
      </View>

      {/* История операций с фильтрами (Пункт 6) */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>История операций</Text>
        </View>

        {/* Фильтры */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              opFilter === 'all' && styles.filterTabActive,
              { borderColor: isDark ? '#1e3a5f' : '#e2e8f0' }
            ]}
            onPress={() => setOpFilter('all')}
          >
            <Text style={[styles.filterTabText, opFilter === 'all' ? styles.filterTabTextActive : { color: theme.textMuted }]}>
              Все ({operations.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              opFilter === 'credit' && styles.filterTabActive,
              { borderColor: isDark ? '#1e3a5f' : '#e2e8f0' }
            ]}
            onPress={() => setOpFilter('credit')}
          >
            <Text style={[styles.filterTabText, opFilter === 'credit' ? styles.filterTabTextActive : { color: theme.textMuted }]}>
              🟢 Пополнения ({creditCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              opFilter === 'debit' && styles.filterTabActive,
              { borderColor: isDark ? '#1e3a5f' : '#e2e8f0' }
            ]}
            onPress={() => setOpFilter('debit')}
          >
            <Text style={[styles.filterTabText, opFilter === 'debit' ? styles.filterTabTextActive : { color: theme.textMuted }]}>
              🔻 Списания ({debitCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Список операций */}
        {filteredOperations.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: isDark ? '#0d1f3c' : '#ffffff', borderColor: theme.border }]}>
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              {operations.length === 0 ? 'Операций пока нет' : 'В этой категории операций нет'}
            </Text>
          </View>
        ) : (
          filteredOperations.map((op, i) => (
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

      {/* Модальное окно контактов (Пункт 2) */}
      <Modal
        visible={showContacts}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContacts(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#0d1f3c' : '#ffffff', borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 22 }}>📞</Text>
                <Text style={[styles.modalTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Контакты парка
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowContacts(false)} style={styles.modalCloseBtn}>
                <Text style={{ color: theme.textMuted, fontSize: 18, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
              Нажмите, чтобы позвонить нужному специалисту:
            </Text>

            {PARK_CONTACTS.map((c, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.contactCard,
                  {
                    backgroundColor: isDark ? '#070d1a' : '#f8fafc',
                    borderColor: isDark ? '#1e3a5f' : '#e2e8f0',
                  },
                ]}
                onPress={() => handleCall(c.phone)}
                activeOpacity={0.7}
              >
                <View style={styles.contactIconWrap}>
                  <Text style={{ fontSize: 22 }}>{c.icon}</Text>
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.contactRoleText, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    {c.role}
                  </Text>
                  {!!c.note && (
                    <Text style={{ color: '#eab308', fontSize: 11, fontWeight: '600' }}>
                      ({c.note})
                    </Text>
                  )}
                  <Text style={styles.contactPhoneText}>{c.displayPhone}</Text>
                </View>

                <View style={styles.callPill}>
                  <Text style={styles.callPillText}>Вызов</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.modalDoneBtn, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}
              onPress={() => setShowContacts(false)}
            >
              <Text style={[styles.modalDoneText, { color: isDark ? '#f8fafc' : '#334155' }]}>
                Закрыть
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 24, overflow: 'hidden', position: 'relative' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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
  name: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginTop: 2 },

  headerContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
  },
  headerContactIcon: { fontSize: 14 },
  headerContactText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },

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

  // Статистика
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  statsHeader: {
    marginBottom: 8,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCol: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginBottom: 2,
  },
  statIncomeValue: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '800',
  },
  statExpenseValue: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '800',
  },

  // Фильтры и операции
  section: { marginHorizontal: 16, marginBottom: 24 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterTabActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },

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
  emptyBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  empty: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  errorBox: { margin: 16, padding: 14, borderRadius: 10, alignItems: 'center' },
  errorText: { color: '#ef4444', marginBottom: 6, fontWeight: '600' },
  retryText: { fontWeight: '700' },

  // Модалка контактов
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  contactIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactRoleText: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 1,
  },
  contactPhoneText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  callPill: {
    backgroundColor: '#1d4ed8',
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  callPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  modalDoneBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalDoneText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
