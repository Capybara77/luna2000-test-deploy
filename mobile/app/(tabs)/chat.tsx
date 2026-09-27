import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { getSavedDriver, fetchChatHistory, getServerUrl } from '../../services/api';
import { CHANNEL_NAMES, CHANNEL_ICONS } from '../../config';
import { updateChatBadge } from './_layout';
import { notify } from '../../services/notificationService';
import { useAppTheme } from '../../services/themeContext';

interface Message {
  id: string;
  driverId: string;
  driverName: string;
  channel: number;
  text: string;
  createdAt: string;
  replyToId?: string;
  replyToSender?: string;
  replyToText?: string;
}

interface ReplyingTo {
  id: string;
  sender: string;
  text: string;
}

const POPULAR_EMOJIS = ['👍', '👋', '🚗', '🚕', '💰', '⚠️', '⛽', '👌', '🔥'];
const ALL_EMOJIS = [
  '👍', '👎', '👋', '👌', '🙏', '🤝', '❤️', '🔥', '🎉',
  '🚗', '🚕', '⛽', '⚠️', '🚨', '🛑', '🔧', '🛠️', '📍',
  '💰', '💳', '💵', '⏳', '⏱️', '☕', '🥪',
  '😀', '😂', '😅', '😎', '🫡', '😡', '😴'
];

function formatMessageDateTime(dateStr: string): string {
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

    if (isToday) {
      return `Сегодня, ${hours}:${minutes}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Вчера, ${hours}:${minutes}`;
    }

    return `${day}.${month}.${d.getFullYear()} ${hours}:${minutes}`;
  } catch {
    return '';
  }
}

export default function ChatScreen() {
  const { theme, isDark } = useAppTheme();
  const [driver, setDriver] = useState<any>(null);
  const [channel, setChannel] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [ch: number]: number }>({ 0: 0, 1: 0, 2: 0 });
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [text, setText] = useState('');
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const connectionRef = useRef<any>(null);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const channelRef = useRef(0);
  channelRef.current = channel;

  const loadHistory = useCallback(async (ch: number, token: string) => {
    try {
      const data = await fetchChatHistory(token, ch);
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (e) {
      console.warn('loadHistory error:', e);
    }
  }, []);

  const onRefresh = async () => {
    if (!driver?.token) return;
    setRefreshing(true);
    await loadHistory(channel, driver.token);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      if (driver?.token) {
        loadHistory(channelRef.current, driver.token);
      }
      // Сбрасываем непрочитанные текущего канала при фокусе
      setUnreadCounts(prev => {
        const updated = { ...prev, [channelRef.current]: 0 };
        const total = Object.values(updated).reduce((a, b) => a + b, 0);
        updateChatBadge?.(total);
        return updated;
      });
    }, [driver?.token, loadHistory])
  );

  useEffect(() => {
    let mounted = true;
    getSavedDriver().then(async (saved) => {
      if (!saved || !mounted) return;
      setDriver(saved);
      await loadHistory(0, saved.token);
      setLoading(false);

      // SignalR
      const currentServerUrl = await getServerUrl();
      const conn = new HubConnectionBuilder()
        .withUrl(`${currentServerUrl}/mobile/chathub?access_token=${saved.token}`)
        .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
        .configureLogging(LogLevel.Warning)
        .build();

      conn.on('ReceiveMessage', (msg: Message) => {
        if (!mounted) return;
        const msgCh = Number(msg.channel ?? 0);

        if (msgCh === channelRef.current) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            // Если есть временное оптимистичное сообщение с таким же текстом — заменяем его
            const tempIdx = prev.findIndex(m => m.id.startsWith('temp_') && m.text === msg.text);
            if (tempIdx !== -1) {
              const next = [...prev];
              next[tempIdx] = msg;
              return next;
            }
            return [...prev, msg];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        } else {
          // Сообщение пришло в другой канал! Добавляем красный бейдж
          setUnreadCounts(prev => {
            const updated = { ...prev, [msgCh]: (prev[msgCh] || 0) + 1 };
            const total = Object.values(updated).reduce((a, b) => a + b, 0);
            updateChatBadge?.(total);
            return updated;
          });

          // In-app уведомление и вибрация
          const chName = CHANNEL_NAMES[msgCh] || 'Чат';
          notify('chat', `${CHANNEL_ICONS[msgCh] || '💬'} ${chName}`, `${msg.driverName || 'Водитель'}: ${msg.text}`);
        }
      });

      conn.onreconnected(async () => {
        if (!mounted) return;
        setConnected(true);
        try {
          await conn.invoke('JoinChannel', channelRef.current);
        } catch (e) {
          console.warn('Re-join channel error:', e);
        }
      });

      conn.onclose(() => { if (mounted) setConnected(false); });

      try {
        await conn.start();
        await conn.invoke('JoinChannel', 0);
        if (mounted) setConnected(true);
        connectionRef.current = conn;
      } catch (e) {
        console.warn('SignalR start error:', e);
      }
    });

    return () => {
      mounted = false;
      connectionRef.current?.stop();
    };
  }, []);

  const switchChannel = async (ch: number) => {
    if (!driver) return;
    setChannel(ch);
    channelRef.current = ch;
    setReplyingTo(null);

    // Сбрасываем непрочитанные для выбранного канала
    setUnreadCounts(prev => {
      const updated = { ...prev, [ch]: 0 };
      const total = Object.values(updated).reduce((a, b) => a + b, 0);
      updateChatBadge?.(total);
      return updated;
    });

    setLoading(true);
    await loadHistory(ch, driver.token);
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
  };

  const startReply = (item: Message) => {
    setReplyingTo({
      id: item.id,
      sender: item.driverName || 'Водитель',
      text: item.text,
    });
    inputRef.current?.focus();
  };

  const sendMessage = async () => {
    const t = text.trim();
    if (!t) return;

    const rep = replyingTo;
    setText('');
    setReplyingTo(null);

    // Оптимистично добавляем локально сразу
    const tempId = 'temp_' + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      driverId: driver?.driverId || '',
      driverName: driver?.fio || 'Я',
      channel,
      text: t,
      replyToId: rep?.id,
      replyToSender: rep?.sender,
      replyToText: rep?.text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      if (connectionRef.current?.state !== 'Connected') {
        await connectionRef.current?.start();
        await connectionRef.current?.invoke('JoinChannel', channel);
      }
      await connectionRef.current?.invoke(
        'SendMessage',
        channel,
        t,
        rep?.id || null,
        rep?.sender || null,
        rep?.text || null
      );
    } catch (e) {
      console.warn('SendMessage error:', e);
    }
  };

  const renderMsg = ({ item }: { item: Message }) => {
    const isOwn = (driver?.driverId && item.driverId === driver.driverId)
               || (driver?.fio && item.driverName === driver.fio)
               || item.id.startsWith('temp_');
    const initials = (item.driverName || '?').split(' ').slice(0, 2).map((p: string) => p[0] || '').join('');
    const dateTime = formatMessageDateTime(item.createdAt);

    return (
      <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
        {!isOwn && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={[styles.bubble, isOwn ? [styles.bubbleOwn, { backgroundColor: theme.msgOwnBg }] : [styles.bubbleOther, { backgroundColor: theme.msgOtherBg, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]]}>
          {!isOwn && <Text style={[styles.senderName, { color: isDark ? '#93c5fd' : '#666' }]}>{item.driverName || 'Водитель'}</Text>}

          {Boolean(item.replyToText) && (
            <View style={[styles.quotePreview, isOwn ? styles.quotePreviewOwn : [styles.quotePreviewOther, { backgroundColor: isDark ? '#162032' : '#f0f4fc', borderLeftColor: theme.primary }]]}>
              <Text style={[styles.quoteSender, isOwn ? styles.quoteSenderOwn : { color: theme.primary }]} numberOfLines={1}>
                ↩️ {item.replyToSender || 'Ответ'}
              </Text>
              <Text style={[styles.quoteText, isOwn ? styles.quoteTextOwn : { color: theme.textMuted }]} numberOfLines={2}>
                {item.replyToText}
              </Text>
            </View>
          )}

          <Text style={[styles.msgText, isOwn ? styles.msgTextOwn : { color: isDark ? theme.msgOtherText : '#363636' }]}>{item.text}</Text>
          <Text style={[styles.msgTime, isOwn ? styles.msgTimeOwn : { color: theme.textMuted }]}>{dateTime}</Text>
        </View>

        <TouchableOpacity
          style={styles.replyBtn}
          onPress={() => startReply(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.replyBtnIcon}>↩️</Text>
        </TouchableOpacity>

        {isOwn && (
          <View style={[styles.avatar, styles.avatarOwn]}>
            <Text style={styles.avatarText}>{initials || 'Я'}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Вкладки каналов с красными кружочками непрочитанных */}
      <View style={[styles.tabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {[0, 1, 2].map(ch => {
          const count = unreadCounts[ch] || 0;
          return (
            <TouchableOpacity key={ch} style={[styles.tab, channel === ch && [styles.tabActive, { borderBottomColor: theme.primary }]]} onPress={() => switchChannel(ch)}>
              <View style={styles.tabContent}>
                <Text style={[styles.tabText, { color: theme.textMuted }, channel === ch && [styles.tabTextActive, { color: theme.primary }]]}>
                  {CHANNEL_ICONS[ch]} {CHANNEL_NAMES[ch]}
                </Text>
                {count > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Статус подключения */}
      <View style={[styles.statusBar, { backgroundColor: isDark ? (connected ? '#064e3b' : '#4c0519') : (connected ? '#f0fff4' : '#fff5f7') }]}>
        <View style={[styles.dot, { backgroundColor: connected ? '#10b981' : '#f43f5e' }]} />
        <Text style={[styles.statusText, { color: theme.textMuted }]}>{connected ? 'В сети' : 'Подключение...'}</Text>
      </View>

      {loading
        ? <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        : <FlatList
            ref={listRef}
            data={messages.filter(m => Number(m.channel ?? 0) === channel)}
            keyExtractor={m => m.id}
            renderItem={renderMsg}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
      }

      {/* Панель ответа на сообщение */}
      {replyingTo && (
        <View style={[styles.replyBar, { backgroundColor: isDark ? '#162032' : '#eef2ff', borderColor: theme.border }]}>
          <View style={styles.replyBarLeft}>
            <Text style={[styles.replyBarSender, { color: theme.primary }]}>↩️ Ответ для {replyingTo.sender}</Text>
            <Text style={[styles.replyBarText, { color: theme.textMuted }]} numberOfLines={1}>{replyingTo.text}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyBarClose}>
            <Text style={[styles.replyBarCloseText, { color: theme.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Панель смайликов */}
      <View style={[styles.emojiRow, { backgroundColor: theme.cardSubtle, borderColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
          {(showAllEmojis ? ALL_EMOJIS : POPULAR_EMOJIS).map((emoji, idx) => (
            <TouchableOpacity key={idx} style={[styles.emojiBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]} onPress={() => setText(prev => prev + emoji)}>
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.emojiToggleBtn, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }, showAllEmojis && styles.emojiToggleBtnActive]}
          onPress={() => setShowAllEmojis(prev => !prev)}
        >
          <Text style={[styles.emojiToggleText, { color: theme.text }]}>{showAllEmojis ? '✕' : '😀+'}</Text>
        </TouchableOpacity>
      </View>

      {/* Поле ввода */}
      <View style={[styles.inputRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
          value={text}
          onChangeText={setText}
          placeholder="Написать..."
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.primary }, !connected && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!connected}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#3273dc' },
  tabContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabText: { fontSize: 12, color: '#666' },
  tabTextActive: { color: '#3273dc', fontWeight: '700' },
  tabBadge: {
    backgroundColor: '#f14668',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  statusBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, color: '#888' },
  list: { padding: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', gap: 6 },
  msgRowOwn: { flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3273dc', justifyContent: 'center', alignItems: 'center' },
  avatarOwn: { backgroundColor: '#48c774' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 12 },
  bubbleOwn: { backgroundColor: '#3273dc', borderBottomRightRadius: 3 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  senderName: { fontSize: 11, fontWeight: '700', color: '#666', marginBottom: 3 },
  quotePreview: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 2,
    marginBottom: 6,
    borderRadius: 4,
  },
  quotePreviewOwn: { borderLeftColor: '#fff', backgroundColor: 'rgba(255,255,255,0.15)' },
  quotePreviewOther: { borderLeftColor: '#3273dc', backgroundColor: '#f0f4fc' },
  quoteSender: { fontSize: 10, fontWeight: '700', color: '#3273dc', marginBottom: 1 },
  quoteSenderOwn: { color: '#fff' },
  quoteText: { fontSize: 11, color: '#555' },
  quoteTextOwn: { color: 'rgba(255,255,255,0.9)' },
  replyBtn: {
    padding: 4,
    opacity: 0.6,
    alignSelf: 'center',
  },
  replyBtnIcon: { fontSize: 14 },
  msgText: { fontSize: 14, color: '#363636', lineHeight: 20 },
  msgTextOwn: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#888', marginTop: 4, textAlign: 'right' },
  msgTimeOwn: { color: 'rgba(255,255,255,0.75)' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: '#c7d2fe',
  },
  replyBarLeft: { flex: 1, marginRight: 8 },
  replyBarSender: { fontSize: 11, fontWeight: '700', color: '#3730a3' },
  replyBarText: { fontSize: 11, color: '#4b5563' },
  replyBarClose: { padding: 4 },
  replyBarCloseText: { fontSize: 14, color: '#6b7280', fontWeight: '700' },
  emojiRow: { flexDirection: 'row', backgroundColor: '#f0f3f8', borderTopWidth: 1, borderColor: '#e4e8f0', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6 },
  emojiList: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emojiBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#fff', marginRight: 4 },
  emojiText: { fontSize: 18 },
  emojiToggleBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#e2e8f0', marginLeft: 4 },
  emojiToggleBtnActive: { backgroundColor: '#cbd5e1' },
  emojiToggleText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  inputRow: { flexDirection: 'row', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 100 },
  sendBtn: { backgroundColor: '#3273dc', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendIcon: { color: '#fff', fontSize: 16 },
});
