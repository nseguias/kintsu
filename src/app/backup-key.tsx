import { Keypair } from '@stellar/stellar-sdk';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Intro, OfflineOnly, Screen, SecretInput, s } from '@/components/ui';
import { Type } from '@/constants/theme';
import { getDraft, nextBackup, seedOf } from '@/lib/draft';

export default function BackupKey() {
  usePreventScreenCapture();
  const router = useRouter();
  const [secret] = useState(() => Keypair.fromRawEd25519Seed(Buffer.from(seedOf(getDraft()))).secret());
  const [check, setCheck] = useState('');
  const groups = secret.match(/.{1,4}/g)!;
  const lastGroup = groups[groups.length - 1];

  return (
    <Screen>
      <OfflineOnly>
        <Intro>Write this key by hand, in groups of 4. Anyone who sees it owns your funds.</Intro>
        <View style={[s.card, { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 }]}>
          {groups.map((g, i) => (
            <Text key={i} style={[Type.mono, { width: '25%' }]}>{g}</Text>
          ))}
        </View>
        <Text style={s.label}>TYPE THE LAST GROUP FROM YOUR PAPER</Text>
        <SecretInput value={check} onChangeText={(t) => setCheck(t.toUpperCase())} maxLength={4} placeholder={'•'.repeat(lastGroup.length)} style={Type.mono} />
        <View style={{ flex: 1 }} />
        <Button title="I wrote it down" disabled={check !== lastGroup} onPress={() => nextBackup(router, 'key')} />
      </OfflineOnly>
    </Screen>
  );
}
