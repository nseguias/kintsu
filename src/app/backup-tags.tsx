import { MIN_PIN, createShards } from '@crypto/shards';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/text';
import { Busy, Button, ErrorText, Icon, Intro, Screen, SecretInput, s } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { getDraft, nextBackup, seedOf } from '@/lib/draft';
import { TagError, cancelTap, writeVerified } from '@/lib/nfc';

export default function BackupTags() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [shards, setShards] = useState<Uint8Array[]>();
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // false = start the next tag's wait right away (no tap on "Write tag N"); a failure or Cancel pauses
  const [paused, setPaused] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => () => void cancelTap(), []);

  const lock = async () => {
    setBusy('Locking with your PIN…');
    try {
      setShards(await createShards(seedOf(getDraft()), pin));
      setPin('');
      setConfirm('');
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy('');
  };

  const write = async () => {
    setError('');
    setPaused(false);
    cancelled.current = false;
    setBusy(`Hold tag ${ids.length + 1} to the back`);
    try {
      const id = await writeVerified(shards![ids.length], ids);
      setIds([...ids, id]);
    } catch (e) {
      setPaused(true);
      if (!cancelled.current) setError(e instanceof TagError ? e.message : 'Lost the tag. Hold it still and try again.');
    }
    setBusy('');
  };

  useEffect(() => {
    if (shards && ids.length < 3 && !busy && !paused) void write();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- write reads the same state; rerun only when these change
  }, [shards, ids, busy, paused]);

  if (busy) {
    const cancel = () => {
      cancelled.current = true;
      cancelTap();
    };
    if (!shards) return <Screen><Busy message={busy} /></Screen>;
    return (
      <Screen>
        <Intro>Any 2 of these 3 tags plus your PIN bring your wallet back. Keep them in different places.</Intro>
        <Tags verified={ids.length} tapping />
        <Busy message={busy} hint="We write it, then read it back to check every byte before moving on." onCancel={cancel} />
      </Screen>
    );
  }

  if (!shards) {
    const short = pin.length > 0 && pin.length < MIN_PIN;
    return (
      <Screen>
        <Intro>Your wallet is split across 3 tags. Any 2 tags plus this PIN bring it back; 1 tag alone reveals nothing.</Intro>
        <SecretInput secureTextEntry placeholder={`PIN, at least ${MIN_PIN} characters`} value={pin} onChangeText={setPin} />
        <SecretInput secureTextEntry placeholder="Type it again" value={confirm} onChangeText={setConfirm} />
        <Text style={[Type.small, { color: short ? Colors.negative : Colors.inkSoft }]}>
          Longer is safer: someone who finds 2 of your tags can guess PINs as long as they like. Letters and numbers both work.
        </Text>
        <Text style={Type.small}>Remember it. If you write it down, keep that paper away from every tag.</Text>
        <ErrorText>{error}</ErrorText>
        <View style={{ flex: 1 }} />
        <Button title="Continue" disabled={pin.length < MIN_PIN || pin !== confirm} onPress={lock} />
      </Screen>
    );
  }

  const done = ids.length === 3;
  return (
    <Screen>
      <Intro>Any 2 of these 3 tags plus your PIN bring your wallet back. Keep them in different places.</Intro>
      <Tags verified={ids.length} />
      <ErrorText>{error}</ErrorText>
      {done && (
        <Intro>Keep the 3 tags in 3 different places. Don’t write anything on them: a blank tag gives no clue it belongs to a wallet.</Intro>
      )}
      <View style={{ flex: 1 }} />
      {done ? (
        <Button title="Done" onPress={() => nextBackup(router, 'tags')} />
      ) : (
        <Button title={`Try tag ${ids.length + 1} again`} onPress={() => write()} />
      )}
    </Screen>
  );
}

/** The 3 tag chips: verified, the one to tap now, and the ones still waiting. */
function Tags({ verified, tapping }: { verified: number; tapping?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {[0, 1, 2].map((i) => {
        const state = i < verified ? 'done' : i === verified ? 'next' : 'waiting';
        return (
          <View
            key={i}
            style={[
              s.card,
              { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: Spacing.sm, borderWidth: 2 },
              state === 'done' && { borderColor: Colors.positive },
              state === 'next' && { borderColor: Colors.primary },
              state === 'waiting' && { backgroundColor: Colors.surfaceAlt, borderStyle: 'dashed', borderColor: '#CFC3A0' },
            ]}>
            <Icon name={state === 'done' ? 'checkmark' : state === 'next' ? 'radio-outline' : 'tablet-portrait-outline'} color={state === 'done' ? Colors.positive : state === 'next' ? Colors.primary : Colors.inkSoft} />
            <Text style={Type.heading}>Tag {i + 1}</Text>
            <Text style={[Type.small, { fontSize: 12 }, state === 'done' && { color: Colors.positive }, state === 'next' && { color: Colors.primary }]}>
              {state === 'done' ? 'Verified' : state === 'next' ? (tapping ? 'Tap now' : 'Next') : 'Waiting'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
