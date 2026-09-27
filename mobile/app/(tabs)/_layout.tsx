import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import InAppNotificationBanner from '../../components/InAppNotificationBanner';
import { useAppTheme } from '../../services/themeContext';

export let updateChatBadge: ((count: number) => void) | null = null;

export default function TabsLayout() {
  const [unreadChat, setUnreadChat] = useState(0);
  const { theme } = useAppTheme();

  useEffect(() => {
    updateChatBadge = setUnreadChat;
    return () => {
      updateChatBadge = null;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <InAppNotificationBanner />
      <Tabs screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.tabBarBg,
          borderTopColor: theme.tabBarBorder,
          paddingBottom: 4,
        },
        headerStyle: { backgroundColor: theme.headerBg },
        headerTintColor: theme.headerText,
        headerTitleStyle: { fontWeight: 'bold' },
      }}>
        <Tabs.Screen
          name="balance"
          options={{ title: 'Баланс', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💰</Text> }}
        />
        <Tabs.Screen
          name="repairs"
          options={{ title: 'Ремонт', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🛠️</Text> }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Чат',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💬</Text>,
            tabBarBadge: unreadChat > 0 ? unreadChat : undefined,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Профиль', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }}
        />
      </Tabs>
    </View>
  );
}
