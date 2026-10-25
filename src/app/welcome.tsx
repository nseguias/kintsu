import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Intro, Screen, s } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';

function Card({ title, body, dark, onPress }: { title: string; body: string; dark?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.card, { gap: 4, padding: 18 }, dark && { backgroundColor: Colors.primary, borderColor: Colors.primary }, pressed && { opacity: 0.8 }]}>
      <Text style={[Type.heading, dark && { color: Colors.white }]}>{title}</Text>
      <Text style={[Type.small, dark && { color: 'rgba(255,255,255,0.8)' }]}>{body}</Text>
    </Pressable>
  );
}

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen noHeader>
      <View style={{ marginTop: 64, gap: Spacing.lg }}>
        <Text style={[Type.display, { fontSize: 44 }]}>Shards</Text>
        <Intro>A Stellar wallet you can always get back: on paper, on NFC tags, or both.</Intro>
      </View>
      <View style={{ flex: 1 }} />
      <Card dark title="Create a new wallet" body="A fresh key, made on this phone" onPress={() => router.push('/create')} />
      <Card title="I already have a wallet" body="Recovery phrase, secret key or NFC tags" onPress={() => router.push('/recover')} />
    </Screen>
  );
}
