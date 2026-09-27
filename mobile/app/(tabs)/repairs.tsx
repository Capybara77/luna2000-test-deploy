import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getSavedDriver, fetchRepairs, createRepairRequest, RepairRequestItem } from '../../services/api';
import { useAppTheme } from '../../services/themeContext';

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

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) return `Сегодня, ${hours}:${minutes}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return `Вчера, ${hours}:${minutes}`;

    return `${day}.${month}.${d.getFullYear()} ${hours}:${minutes}`;
  } catch {
    return '';
  }
}

export default function RepairsScreen() {
  const { theme, isDark } = useAppTheme();
  const [driver, setDriver] = useState<any>(null);
  const [repairs, setRepairs] = useState<RepairRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [problemText, setProblemText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const saved = await getSavedDriver();
      if (!saved) return;
      setDriver(saved);
      const data = await fetchRepairs(saved.token);
      setRepairs(data || []);
    } catch {
      setRepairs([]);
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleCreate = async () => {
    const trimmed = problemText.trim();
    if (!trimmed) {
      Alert.alert('Ошибка', 'Опишите неисправность или требуемый ремонт');
      return;
    }
    if (!driver?.token) return;

    setSubmitting(true);
    try {
      await createRepairRequest(driver.token, trimmed);
      setProblemText('');
      setModalVisible(false);
      await loadData();
      Alert.alert('Успешно', 'Заявка отправлена диспетчерам. Они увидят её и свяжутся с вами.');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusBadge = (status: number, name: string) => {
    let bgColor = '#e0f2fe';
    let textColor = '#0369a1';
    let icon = '🔵';

    if (status === 1) {
      bgColor = '#fef3c7';
      textColor = '#b45309';
      icon = '🟡';
    } else if (status === 2) {
      bgColor = '#dcfce7';
      textColor = '#15803d';
      icon = '🟢';
    } else if (status === 3) {
      bgColor = '#fee2e2';
      textColor = '#b91c1c';
      icon = '🔴';
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusText, { color: textColor }]}>
          {icon} {name}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: RepairRequestItem }) => (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
      <View style={styles.cardHeader}>
        {renderStatusBadge(item.status, item.statusName)}
        <Text style={[styles.dateText, { color: theme.textMuted }]}>{formatDateTime(item.createdAt)}</Text>
      </View>

      <View style={styles.carRow}>
        <Text style={styles.carIcon}>🚗</Text>
        <Text style={[styles.carText, { color: theme.textMuted }]}>{item.carInfo}</Text>
      </View>

      <Text style={[styles.problemText, { color: theme.text }]}>{item.text}</Text>

      {item.adminComment ? (
        <View style={[styles.replyBox, { backgroundColor: isDark ? '#143825' : '#f0fdf4', borderColor: '#22c55e' }]}>
          <Text style={[styles.replyTitle, { color: isDark ? '#4ade80' : '#15803d' }]}>💬 Ответ диспетчера:</Text>
          <Text style={[styles.replyText, { color: isDark ? '#bbf7d0' : '#14532d' }]}>{item.adminComment}</Text>
        </View>
      ) : (
        <Text style={[styles.noReplyText, { color: theme.textMuted }]}>⏳ Ожидает ответа диспетчера</Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Шапка с кнопкой добавления */}
      <View style={[styles.header, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>🛠️ Заявки на ремонт</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Видны только вам и диспетчерам</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.primary }]} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>＋ Создать</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <FlatList
          data={repairs}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🛠️</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Заявок на ремонт пока нет</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                Если в автомобиле что-то сломалось или требуется ТО, нажмите кнопку «Создать» выше.
              </Text>
            </View>
          }
        />
      )}

      {/* Модальное окно создания заявки */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>🛠️ Новая заявка на ремонт</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.closeBtn, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Опишите проблему или что нужно сделать:</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
              placeholder="Например: Стучит передняя подвеска, замена масла, горит чек..."
              placeholderTextColor={theme.textMuted}
              value={problemText}
              onChangeText={setProblemText}
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
              ℹ Заявка отправится диспетчерам и администраторам парка. Другие водители её не увидят.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: theme.cardSubtle }]}
                onPress={() => setModalVisible(false)}
                disabled={submitting}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary }, submitting && styles.submitBtnDisabled]}
                onPress={handleCreate}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Отправить заявку</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  addBtn: {
    backgroundColor: '#3273dc',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  dateText: { fontSize: 11, color: '#94a3b8' },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  carIcon: { fontSize: 14 },
  carText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  problemText: { fontSize: 14, color: '#1e293b', lineHeight: 20, marginBottom: 10 },
  replyBox: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 3,
    borderColor: '#22c55e',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  replyTitle: { fontSize: 12, fontWeight: '700', color: '#15803d', marginBottom: 2 },
  replyText: { fontSize: 13, color: '#14532d' },
  noReplyText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  closeBtn: { fontSize: 20, color: '#94a3b8', padding: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    height: 110,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  disclaimer: { fontSize: 11, color: '#64748b', marginBottom: 16, lineHeight: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#475569', fontWeight: '600', fontSize: 14 },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3273dc',
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
