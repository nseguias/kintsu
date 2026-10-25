import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Button, Intro, Screen } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen noHeader>
      <View style={{ marginTop: 64, gap: Spacing.md }}>
        <Text style={Type.display}>Shards</Text>
        <Intro>A Stellar wallet you can always get back: on paper, on NFC tags, or both.</Intro>
      </View>
      <View style={{ flex: 1 }} />
      <Button title="Create a new wallet" onPress={() => router.push('/create')} />
      <Button kind="secondary" title="I already have a wallet" onPress={() => router.push('/recover')} />
    </Screen>
  );
}
