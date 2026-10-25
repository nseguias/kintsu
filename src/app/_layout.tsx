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
        <Stack.Screen name="index" options={{ title: 'NFC check' }} />
      </Stack>
    </>
  );
}
