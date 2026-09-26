import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { getSavedDriver, fetchChatHistory } from '../../services/api';
import { SIGNALR_HUB_URL, CHANNEL_NAMES, CHANNEL_ICONS } from '../../config';

interface Message {
  id: string;
  driverId: string;
  driverName: string;
  channel: number;
  text: string;
  createdAt: string;
}

export default function ChatScreen() {
  const [driver, setDriver] = useState<any>(null);
  const [channel, setChannel] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const connectionRef = useRef<any>(null);
  const listRef = useRef<FlatList>(null);

  const loadHistory = useCallback(async (ch: number, token: string) => {
    try {
      const data = await fetchChatHistory(token, ch);
      setMessages(Array.isArray(data) ? data : []);
    } catch { setMessages([]); }
  }, []);

  useEffect(() => {
    let mounted = true;
    getSavedDriver().then(async (saved) => {
      if (!saved || !mounted) return;
      setDriver(saved);
      await loadHistory(0, saved.token);
      setLoading(false);

      // SignalR
      const conn = new HubConnectionBuilder()
        .withUrl(`${SIGNALR_HUB_URL}?access_token=${saved.token}`)
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      conn.on('ReceiveMessage', (msg: Message) => {
        if (!mounted) return;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      });

      conn.onreconnected(() => { if (mounted) setConnected(true); });
      conn.onclose(() => { if (mounted) setConnected(false); });

      try {
        await conn.start();
        await conn.invoke('JoinChannel', 0);
        if (mounted) setConnected(true);
        connectionRef.current = conn;
      } catch (e) { console.warn('SignalR error', e); }
    });

    return () => {
      mounted = false;
      connectionRef.current?.stop();
    };
  }, []);

  const switchChannel = async (ch: number) => {
    if (!driver) return;
    setChannel(ch);
    setLoading(true);
    await loadHistory(ch, driver.token);
    setLoading(false);
    const conn = connectionRef.current;
    if (conn?.state === 'Connected') {
      await conn.invoke('LeaveChannel', channel);
      await conn.invoke('JoinChannel', ch);
    }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 200);
  };

  const sendMessage = async () => {
    const t = text.trim();
    if (!t || !connected) return;
    setText('');
    try {
      await connectionRef.current?.invoke('SendMessage', channel, t);
    } catch (e) { console.warn(e); }
  };

  const renderMsg = ({ item }: { item: Message }) => {
    const isOwn = item.driverId === driver?.driverId;
    const time = new Date(item.createdAt + 'Z').toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    const initials = (item.driverName || '?').split(' ').slice(0, 2).map((p: string) => p[0] || '').join('');
    return (
      <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
        {!isOwn && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {!isOwn && <Text style={styles.senderName}>{item.driverName}</Text>}
          <Text style={[styles.msgText, isOwn && styles.msgTextOwn]}>{item.text}</Text>
          <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>{time}</Text>
        </View>
        {isOwn && (
          <View style={[styles.avatar, styles.avatarOwn]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Вкладки каналов */}
      <View style={styles.tabs}>
        {[0, 1, 2].map(ch => (
          <TouchableOpacity key={ch} style={[styles.tab, channel === ch && styles.tabActive]} onPress={() => switchChannel(ch)}>
            <Text style={[styles.tabText, channel === ch && styles.tabTextActive]}>
              {CHANNEL_ICONS[ch]} {CHANNEL_NAMES[ch]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Статус подключения */}
      <View style={[styles.statusBar, { backgroundColor: connected ? '#f0fff4' : '#fff5f7' }]}>
        <View style={[styles.dot, { backgroundColor: connected ? '#48c774' : '#f14668' }]} />
        <Text style={styles.statusText}>{connected ? 'Подключено' : 'Нет соединения'}</Text>
      </View>

      {loading
        ? <View style={styles.center}><ActivityIndicator color="#3273dc" /></View>
        : <FlatList
            ref={listRef}
            data={messages.filter(m => m.channel === channel)}
            keyExtractor={m => m.id}
            renderItem={renderMsg}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
      }

      {/* Ввод */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Написать..."
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={[styles.sendBtn, !connected && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!connected}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#3273dc' },
  tabText: { fontSize: 12, color: '#999' },
  tabTextActive: { color: '#3273dc', fontWeight: '700' },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, color: '#888' },
  list: { padding: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', gap: 6 },
  msgRowOwn: { flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3273dc', justifyContent: 'center', alignItems: 'center' },
  avatarOwn: { backgroundColor: '#48c774' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble: { maxWidth: '72%', padding: 10, borderRadius: 12 },
  bubbleOwn: { backgroundColor: '#3273dc', borderBottomRightRadius: 3 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  senderName: { fontSize: 11, fontWeight: '700', color: '#666', marginBottom: 2 },
  msgText: { fontSize: 14, color: '#363636', lineHeight: 20 },
  msgTextOwn: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#aaa', marginTop: 3, textAlign: 'right' },
  msgTimeOwn: { color: 'rgba(255,255,255,0.65)' },
  inputRow: { flexDirection: 'row', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 100 },
  sendBtn: { backgroundColor: '#3273dc', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendIcon: { color: '#fff', fontSize: 16 },
});
