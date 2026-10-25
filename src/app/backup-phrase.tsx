import { usePreventScreenCapture } from 'expo-screen-capture';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, OfflineOnly, Screen, SecretInput, s } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { getDraft } from '@/lib/draft';

export default function BackupPhrase() {
  usePreventScreenCapture();
  const router = useRouter();
  const d = getDraft();
  const words = d.mnemonic!.split(' ');
  const [usePass, setUsePass] = useState(false);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const passOk = !usePass || (pass.length > 0 && pass === confirm);

  return (
    <Screen>
      <OfflineOnly>
        <Text style={[Type.body, { color: Colors.inkSoft }]}>
          Write these {words.length} words in order with pen on paper. No photos; screenshots are blocked.
        </Text>
        <View style={[s.card, { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.sm }]}>
          {words.map((w, i) => (
            <View key={i} style={{ width: '33.3%', flexDirection: 'row', gap: 6, alignItems: 'baseline' }}>
              <Text style={[Type.tiny, { width: 18, textAlign: 'right' }]}>{i + 1}</Text>
              <Text style={[Type.body, { fontWeight: '500' }]}>{w}</Text>
            </View>
          ))}
        </View>

        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: usePass }} onPress={() => setUsePass(!usePass)} style={{ flexDirection: 'row', gap: Spacing.md }}>
          <Text style={{ fontSize: 20, color: Colors.primary }}>{usePass ? '☑' : '☐'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={Type.heading}>Add a passphrase</Text>
            <Text style={Type.small}>Extra words only you know. Someone who finds the paper still can’t get in.</Text>
          </View>
        </Pressable>
        {usePass && (
          <>
            <SecretInput secureTextEntry placeholder="Passphrase" value={pass} onChangeText={setPass} />
            <SecretInput secureTextEntry placeholder="Type it again" value={confirm} onChangeText={setConfirm} />
            <Text style={[Type.small, { color: Colors.negative }]}>
              Forget it and the phrase opens a different, empty wallet. There is no “wrong passphrase” error. Write it down separately from the words.
            </Text>
          </>
        )}
        <View style={{ flex: 1 }} />
        <Button
          title="I wrote it down"
          disabled={!passOk}
          onPress={() => {
            d.passphrase = usePass ? pass : '';
            router.push('/verify');
          }}
        />
      </OfflineOnly>
    </Screen>
  );
}
