import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#3273dc' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' } }}>
      <Stack.Screen name="login" options={{ title: 'Вход', headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
