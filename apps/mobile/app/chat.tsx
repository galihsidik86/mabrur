import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/auth';
import { colors } from '../src/theme';
import { api } from '../src/services/api';
import { getGroups } from '../src/services/db';

interface Message {
  id: string;
  text: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

export default function ChatScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async (gid: string) => {
    try {
      const msgs = await api.getMessages(gid);
      setMessages(msgs);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const groups = await getGroups();
      if (groups.length > 0) {
        setGroupId(groups[0].id);
        await load(groups[0].id);
        pollRef.current = setInterval(() => load(groups[0].id), 5000);
      }
    })();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const send = async () => {
    if (!input.trim() || !groupId || sending) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(groupId, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput('');
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch {}
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.user_id === user?.id;
    return (
      <View style={[s.msgRow, isMe && s.msgRowMe]}>
        {!isMe && <View style={s.msgAvatar}><Text style={s.msgAvatarText}>{item.user_name[0]}</Text></View>}
        <View style={[s.msgBubble, isMe ? s.bubbleMe : s.bubbleOther]}>
          {!isMe && <Text style={s.msgName}>{item.user_name}</Text>}
          <Text style={[s.msgText, isMe && { color: '#fff' }]}>{item.text}</Text>
          <Text style={[s.msgTime, isMe && { color: 'rgba(255,255,255,0.7)' }]}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Chat Rombongan</Text>
        <View style={{ width: 34 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={<Text style={s.empty}>Belum ada pesan. Mulai percakapan!</Text>}
        />
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ketik pesan..."
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <TouchableOpacity style={s.sendBtn} onPress={send} disabled={!input.trim() || sending}>
            <Ionicons name="send" size={20} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: 'rgba(245,241,232,0.9)' },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  list: { padding: 16, paddingBottom: 8 },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 40 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 999, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 10, paddingHorizontal: 14 },
  bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  msgName: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary, marginBottom: 2 },
  msgText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text, lineHeight: 20 },
  msgTime: { fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textFaint, marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', padding: 12, paddingBottom: 16, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  input: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
