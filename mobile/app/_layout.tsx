import { Stack } from 'expo-router';
import { ThemeProvider, useAppTheme } from '../services/themeContext';

function RootNav() {
  const { theme } = useAppTheme();

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: theme.headerBg },
      headerTintColor: theme.headerText,
      headerTitleStyle: { fontWeight: 'bold' },
      contentStyle: { backgroundColor: theme.background },
    }}>
      <Stack.Screen name="login" options={{ title: 'Вход', headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNav />
    </ThemeProvider>
  );
}
