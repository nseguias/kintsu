import { combineShards, openShard, type Shard } from '@crypto/shards';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Screen, SecretInput, s } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { getDraft, nextBackup, startDraft } from '@/lib/draft';
import { cancelTap, readShardBytes } from '@/lib/nfc';

export default function Restore() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<Shard>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const cancelled = useRef(false);
  useEffect(() => () => void cancelTap(), []);

  const tap = async () => {
    setError('');
    cancelled.current = false;
    setBusy(`Hold ${first ? 'a second' : 'any one of your'} tag${first ? '' : 's'} flat against the back of your phone`);
    try {
      const { bytes } = await readShardBytes();
      setBusy('Unlocking…');
      const shard = await openShard(bytes, pin);
      if (!first) {
        setFirst(shard);
      } else {
        const seed = await combineShards(first, shard);
        startDraft({ rawSeed: seed, imported: false });
        getDraft().done.push('tags');
        await nextBackup(router);
        return;
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      if (!cancelled.current) setError(msg.startsWith('Wrong PIN') ? 'Wrong PIN, or this isn’t one of your backup tags.' : msg || 'Lost the tag. Hold it still and try again.');
    }
    setBusy('');
  };

  if (busy) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[Type.heading, { textAlign: 'center' }]}>{busy}</Text>
        </View>
        <Button
          kind="secondary"
          title="Cancel"
          onPress={() => {
            cancelled.current = true;
            cancelTap();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={[Type.body, { color: Colors.inkSoft }]}>Any 2 of your 3 tags plus the PIN you chose bring your wallet back.</Text>
      {!first && <SecretInput secureTextEntry placeholder="PIN" value={pin} onChangeText={setPin} />}
      {[0, 1].map((i) => (
        <View key={i} style={[s.card, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          <Text style={Type.heading}>{i ? 'Second tag' : 'First tag'}</Text>
          <Text style={[Type.small, { color: i === 0 && first ? Colors.positive : Colors.inkSoft }]}>
            {i === 0 && first ? 'Unlocked ✓' : ''}
          </Text>
        </View>
      ))}
      {!!error && <Text style={[Type.small, { color: Colors.negative }]}>{error}</Text>}
      <View style={{ flex: 1 }} />
      <Button title={first ? 'Tap the second tag' : 'Tap a tag'} disabled={!pin} onPress={tap} />
      {!!first && <Button kind="link" title="Start over" onPress={() => { setFirst(undefined); setError(''); }} />}
    </Screen>
  );
}
