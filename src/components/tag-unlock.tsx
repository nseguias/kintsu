import { combineShards, openShard, type Shard } from '@crypto/shards';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Busy, Button, ErrorText, Intro, List, Row, SecretInput } from '@/components/ui';
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
    const cancel = () => {
      cancelled.current = true;
      cancelTap();
    };
    return <Busy message={busy} onCancel={cancel} />;
  }

  return (
    <>
      <Intro>{intro}</Intro>
      {!first && <SecretInput secureTextEntry placeholder="PIN you chose for your tags" value={pin} onChangeText={setPin} />}
      <List>
        {[0, 1].map((i) => (
          <Row
            key={i}
            icon={i === 0 && first ? 'checkmark' : 'radio-outline'}
            tone={i === 0 && first ? 'positive' : undefined}
            active={i === Number(!!first) && !!pin}
            title={i ? 'Second tag' : 'First tag'}
            right={i === 0 && first ? 'Unlocked' : i === Number(!!first) ? (i ? 'Tap any other tag' : 'Tap any tag') : ''}
          />
        ))}
      </List>
      <ErrorText>{error}</ErrorText>
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
