import { Fraunces_600SemiBold, Fraunces_700Bold, useFonts } from '@expo-google-fonts/fraunces';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';

import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: Colors.background }} />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.ink,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.background },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: 'Create a wallet' }} />
        <Stack.Screen name="import" options={{ title: 'Import a wallet' }} />
        <Stack.Screen name="backup" options={{ title: 'Back up your wallet' }} />
        <Stack.Screen name="backup-phrase" options={{ title: 'Recovery phrase' }} />
        <Stack.Screen name="verify" options={{ title: 'Check your paper' }} />
        <Stack.Screen name="backup-key" options={{ title: 'Secret key' }} />
        <Stack.Screen name="backup-tags" options={{ title: 'NFC tags' }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="nfc-check" options={{ title: 'NFC check' }} />
      </Stack>
    </>
  );
}
