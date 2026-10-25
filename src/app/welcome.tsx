import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Choice, Intro, Screen } from '@/components/ui';
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
      <Choice title="Create a new wallet" body="A fresh 12 or 24-word recovery phrase" selected={false} onPress={() => router.push('/create')} />
      <Choice title="Import a wallet" body="Type a recovery phrase or an S… key from your paper" selected={false} onPress={() => router.push('/import')} />
      <Choice title="Restore from NFC tags" body="Any 2 of your 3 tags plus your PIN" selected={false} onPress={() => router.push('/restore')} />
    </Screen>
  );
}
