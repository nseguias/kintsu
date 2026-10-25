import { useRouter } from 'expo-router';
import React from 'react';

import { Intro, List, Row, Screen } from '@/components/ui';

export default function Recover() {
  const router = useRouter();
  return (
    <Screen>
      <Intro>Bring back a wallet from any of its backups. Shards or any other Stellar wallet.</Intro>
      <List>
        <Row icon="document-text-outline" title="Recovery phrase" detail="12 or 24 words on paper" onPress={() => router.push('/import?mode=phrase')} />
        <Row icon="key-outline" title="Secret key" detail="The 56-character S… key on paper" onPress={() => router.push('/import?mode=key')} />
        <Row icon="radio-outline" title="NFC tags" detail="Any 2 of your 3 tags plus your PIN" onPress={() => router.push('/restore')} />
      </List>
    </Screen>
  );
}
