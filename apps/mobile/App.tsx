import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/lib/auth-context';
import { ChatProvider } from './src/lib/chat-context';
import { LanguageProvider } from './src/lib/language-context';
import { ThemeProvider, useTheme } from './src/lib/theme-context';
import { RootNavigator } from './src/navigation/RootNavigator';

function AppShell() {
  const { theme, colors } = useTheme();

  const navTheme = useMemo(
    () => ({
      dark: theme === 'dark',
      colors: {
        primary: colors.brand[600],
        background: colors.page,
        card: colors.white,
        text: colors.text,
        border: colors.border,
        notification: colors.accent[600],
      },
      fonts: DefaultTheme.fonts,
    }),
    [theme, colors],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ChatProvider>
              <AppShell />
            </ChatProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
