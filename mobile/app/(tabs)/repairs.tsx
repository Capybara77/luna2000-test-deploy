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
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getSavedDriver, fetchRepairs, createRepairRequest, RepairRequestItem, getServerUrl } from '../../services/api';
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
  const [serverUrl, setServerUrlState] = useState('');
  const [repairs, setRepairs] = useState<RepairRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [problemText, setProblemText] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    getServerUrl().then(setServerUrlState);
  }, []);

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

  const processAndSetPhoto = async (rawUri: string, width?: number) => {
    setCompressing(true);
    try {
      const actions: ImageManipulator.Action[] = [];
      if (!width || width > 1280) {
        actions.push({ resize: { width: 1280 } });
      }

      const manipResult = await ImageManipulator.manipulateAsync(
        rawUri,
        actions,
        {
          compress: 0.75,
          format: ImageManipulator.SaveFormat.WEBP,
          base64: true,
        }
      );

      if (manipResult.base64) {
        setPhoto({
          uri: manipResult.uri,
          base64: manipResult.base64,
        });
      } else {
        setPhoto({
          uri: manipResult.uri,
          base64: '',
        });
      }
    } catch (err) {
      console.warn('Error optimizing photo:', err);
      // Fallback
      setPhoto({
        uri: rawUri,
        base64: '',
      });
    } finally {
      setCompressing(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Камера', 'Для снимка поломки разрешите доступ к камере.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets && res.assets[0]?.uri) {
      await processAndSetPhoto(res.assets[0].uri, res.assets[0].width);
    }
  };

  const pickGalleryPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Галерея', 'Для выбора фото разрешите доступ к галерее.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets && res.assets[0]?.uri) {
      await processAndSetPhoto(res.assets[0].uri, res.assets[0].width);
    }
  };

  const handleCreate = async () => {
    const trimmed = problemText.trim();
    if (!trimmed) {
      Alert.alert('Ошибка', 'Опишите неисправность или требуемый ремонт');
      return;
    }
    if (!driver?.token) return;

    setSubmitting(true);
    try {
      await createRepairRequest(driver.token, trimmed, photo?.base64);
      setProblemText('');
      setPhoto(null);
      setModalVisible(false);
      await loadData();
      Alert.alert('Успешно', 'Заявка отправлена диспетчерам и механикам парка.');
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

  const getFullPhotoUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = serverUrl.replace(/\/+$/, '');
    const rel = path.startsWith('/') ? path : `/${path}`;
    return `${base}${rel}`;
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

      {/* Фото поломки если прикреплено */}
      {!!item.photoUrl && (
        <TouchableOpacity
          style={styles.cardImageContainer}
          activeOpacity={0.85}
          onPress={() => setPreviewImage(getFullPhotoUrl(item.photoUrl!))}
        >
          <Image
            source={{ uri: getFullPhotoUrl(item.photoUrl) }}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <View style={styles.imageZoomBadge}>
            <Text style={styles.imageZoomText}>🔍 Увеличить</Text>
          </View>
        </TouchableOpacity>
      )}

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
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Видны вам, диспетчерам и механикам</Text>
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
                Если в автомобиле что-то сломалось, требуется ТО или замена масла, нажмите «Создать» выше.
              </Text>
            </View>
          }
        />
      )}

      {/* Модальное окно создания заявки */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
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
                numberOfLines={3}
                maxLength={500}
              />

              {/* Кнопки прикрепления фото */}
              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 8 }]}>Фотография повреждения (необязательно):</Text>
              
              {compressing ? (
                <View style={[styles.previewContainer, { paddingVertical: 20, alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={{ marginTop: 8, fontSize: 13, color: theme.textMuted }}>Оптимизация в WebP (~150 КБ)...</Text>
                </View>
              ) : photo ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: photo.uri }} style={styles.previewImage} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ fontSize: 12, color: '#10b981', fontWeight: '600' }}>⚡ Сжато в WebP</Text>
                    <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setPhoto(null)}>
                      <Text style={styles.removePhotoText}>✕ Удалить фото</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.photoButtonsRow}>
                  <TouchableOpacity style={[styles.photoActionBtn, { backgroundColor: isDark ? '#1e293b' : '#eff6ff' }]} onPress={takePhoto}>
                    <Text style={styles.photoActionIcon}>📷</Text>
                    <Text style={[styles.photoActionText, { color: isDark ? '#93c5fd' : '#2563eb' }]}>Снять на камеру</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.photoActionBtn, { backgroundColor: isDark ? '#1e293b' : '#eff6ff' }]} onPress={pickGalleryPhoto}>
                    <Text style={styles.photoActionIcon}>🖼️</Text>
                    <Text style={[styles.photoActionText, { color: isDark ? '#93c5fd' : '#2563eb' }]}>Из галереи</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
                ℹ Заявка отправится механикам и диспетчерам парка.
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модальное окно просмотра полноразмерного фото */}
      {!!previewImage && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <View style={styles.zoomOverlay}>
            <TouchableOpacity style={styles.closeZoomBtn} onPress={() => setPreviewImage(null)}>
              <Text style={styles.closeZoomText}>✕ Закрыть</Text>
            </TouchableOpacity>
            <Image source={{ uri: previewImage }} style={styles.zoomImage} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  list: { padding: 12, paddingBottom: 28 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  dateText: { fontSize: 11 },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  carIcon: { fontSize: 14 },
  carText: { fontSize: 13, fontWeight: '600' },
  problemText: { fontSize: 14, lineHeight: 20, marginBottom: 8, fontWeight: '500' },

  cardImageContainer: {
    position: 'relative',
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
  },
  imageZoomBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageZoomText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  replyBox: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  replyTitle: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  replyText: { fontSize: 13, lineHeight: 18 },
  noReplyText: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: { fontSize: 22, padding: 4 },
  inputLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 8,
  },

  photoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  photoActionIcon: {
    fontSize: 18,
  },
  photoActionText: {
    fontSize: 12,
    fontWeight: '700',
  },

  previewContainer: {
    marginBottom: 12,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: 6,
  },
  removePhotoBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  removePhotoText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },

  disclaimer: { fontSize: 11, marginBottom: 16, lineHeight: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: { fontWeight: '700', fontSize: 14 },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  zoomOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeZoomBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeZoomText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  zoomImage: {
    width: '100%',
    height: '80%',
  },
});
