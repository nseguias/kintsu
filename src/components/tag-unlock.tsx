import { combineShards, openShard, type Shard } from '@crypto/shards';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, SecretInput, s } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { cancelTap, readShardBytes } from '@/lib/nfc';

/**
 * PIN + any 2 tags → the recovery key's 32-byte seed, handed to `onSeed` and not kept.
 * Used by Restore (save it) and by key changes like turning on 2FA (sign once, then forget it).
 */
export function TagUnlock({ intro, onSeed }: { intro: string; onSeed: (seed: Uint8Array) => Promise<void> }) {
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
        setBusy('Working…');
        await onSeed(await combineShards(first, shard));
        setFirst(undefined);
        setPin('');
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      if (!cancelled.current) setError(msg.startsWith('Wrong PIN') ? 'Wrong PIN, or this isn’t one of your backup tags.' : msg || 'Lost the tag. Hold it still and try again.');
    }
    setBusy('');
  };

  if (busy) {
    return (
      <>
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
      </>
    );
  }

  return (
    <>
      <Text style={[Type.body, { color: Colors.inkSoft }]}>{intro}</Text>
      {!first && <SecretInput secureTextEntry placeholder="PIN you chose for your tags" value={pin} onChangeText={setPin} />}
      {[0, 1].map((i) => (
        <View key={i} style={[s.card, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          <Text style={Type.heading}>{i ? 'Second tag' : 'First tag'}</Text>
          <Text style={[Type.small, { color: i === 0 && first ? Colors.positive : Colors.inkSoft }]}>{i === 0 && first ? 'Unlocked ✓' : ''}</Text>
        </View>
      ))}
      {!!error && <Text style={[Type.small, { color: Colors.negative }]}>{error}</Text>}
      <View style={{ flex: 1 }} />
      <Button title={first ? 'Tap the second tag' : 'Tap a tag'} disabled={!pin} onPress={tap} />
      {!!first && (
        <Button
          kind="link"
          title="Start over"
          onPress={() => {
            setFirst(undefined);
            setError('');
          }}
        />
      )}
    </>
  );
}
