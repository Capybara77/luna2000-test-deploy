import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, SafeAreaView } from 'react-native';
import { onAppNotification, AppNotification } from '../services/notificationService';

export default function InAppNotificationBanner() {
  const [current, setCurrent] = useState<AppNotification | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    const unsub = onAppNotification((notif) => {
      setCurrent(notif);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      timeoutRef.current = setTimeout(() => {
        dismiss();
      }, 4000);
    });

    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setCurrent(null));
  };

  if (!current) return null;

  const getBorderColor = () => {
    switch (current.type) {
      case 'topup': return '#48c774';
      case 'rent': return '#f14668';
      default: return '#3273dc';
    }
  };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ translateY: slideAnim }] }]}>
      <SafeAreaView>
        <TouchableOpacity style={[styles.card, { borderLeftColor: getBorderColor() }]} activeOpacity={0.9} onPress={dismiss}>
          <View style={styles.content}>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.message} numberOfLines={2}>{current.message}</Text>
          </View>
          <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  content: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: '#4a4a4a',
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '700',
  },
});
