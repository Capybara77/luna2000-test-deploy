import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  isDark: boolean;
  background: string;
  card: string;
  cardSubtle: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  headerBg: string;
  headerText: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabBarInactive: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  msgOtherBg: string;
  msgOtherText: string;
  msgOwnBg: string;
  msgOwnText: string;
}

export const lightTheme: ThemeColors = {
  isDark: false,
  background: '#f5f5f5',
  card: '#ffffff',
  cardSubtle: '#f0f3f8',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  primary: '#3273dc',
  headerBg: '#3273dc',
  headerText: '#ffffff',
  tabBarBg: '#ffffff',
  tabBarBorder: '#e2e8f0',
  tabBarInactive: '#94a3b8',
  inputBg: '#ffffff',
  inputBorder: '#d1d5db',
  inputText: '#1e293b',
  msgOtherBg: '#ffffff',
  msgOtherText: '#1e293b',
  msgOwnBg: '#3273dc',
  msgOwnText: '#ffffff',
};

export const darkTheme: ThemeColors = {
  isDark: true,
  // Deep navy — base layer
  background: '#070d1a',
  // Elevated surfaces — slightly lighter navy
  card: '#0d1f3c',
  cardSubtle: '#0b1830',
  // Text
  text: '#f0f6ff',
  textMuted: '#64748b',
  // Borders — very subtle glow lines
  border: '#1e3a5f',
  // Electric blue accent
  primary: '#3b82f6',
  // Header — same as card
  headerBg: '#0d1f3c',
  headerText: '#f0f6ff',
  // Tab bar — deep navy with thin border
  tabBarBg: '#070d1a',
  tabBarBorder: '#1e3a5f',
  tabBarInactive: '#334155',
  // Inputs — glassy dark
  inputBg: '#0a1628',
  inputBorder: '#1e3a5f',
  inputText: '#f0f6ff',
  // Chat bubbles
  msgOtherBg: '#0d1f3c',
  msgOtherText: '#f0f6ff',
  msgOwnBg: '#1d4ed8',
  msgOwnText: '#ffffff',
};

const THEME_STORAGE_KEY = 'luna_app_theme';

interface ThemeContextType {
  isDark: boolean;
  theme: ThemeColors;
  toggleTheme: () => void;
  setDark: (val: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  theme: lightTheme,
  toggleTheme: () => {},
  setDark: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(saved => {
      if (saved !== null) {
        setIsDark(saved === 'dark');
      } else {
        // По умолчанию — тёмная тема (Dark Premium)
        setIsDark(true);
      }
    });
  }, []);

  const setDark = (val: boolean) => {
    setIsDark(val);
    AsyncStorage.setItem(THEME_STORAGE_KEY, val ? 'dark' : 'light');
  };

  const toggleTheme = () => {
    setDark(!isDark);
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDark, theme, toggleTheme, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
