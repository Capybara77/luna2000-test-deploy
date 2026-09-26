import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#3273dc',
      tabBarStyle: { paddingBottom: 4 },
      headerStyle: { backgroundColor: '#3273dc' },
      headerTintColor: '#fff',
    }}>
      <Tabs.Screen
        name="balance"
        options={{ title: 'Баланс', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💰</Text> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Чат', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💬</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Профиль', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }}
      />
    </Tabs>
  );
}
