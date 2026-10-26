import { MIN_PIN, combineShards, createShards, openShard, type Shard } from '@crypto/shards';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/text';
import { Busy, Button, ErrorText, Icon, Intro, Screen, SecretInput, s } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { getDraft, nextBackup, seedOf } from '@/lib/draft';
import { TagError, cancelTap, readShardBytes, writeVerified } from '@/lib/nfc';

const pause = () => new Promise((r) => setTimeout(r, 400));
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

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
  // the PIN stays in memory only until the recovery check below passes (or this screen closes)
  const pinFor = useRef('');
  // tags read back in the final check, by position (0-2) in the set just written
  const [tested, setTested] = useState<{ id: string; index: number; shard: Shard }[]>([]);
  const [recoverable, setRecoverable] = useState(false);
  const [testing, setTesting] = useState(false); // the test is its own step, started with a button
  const [skipped, setSkipped] = useState(false); // the test is recommended, not required
  useEffect(() => () => void cancelTap(), []);

  const lock = async () => {
    setBusy('Locking with your PIN…');
    try {
      setShards(await createShards(seedOf(getDraft()), pin));
      pinFor.current = pin;
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
      let id = '';
      // the tag just written is often still on the phone: wait quietly for a new one
      while (!id) {
        id = await writeVerified(shards![ids.length], ids).catch(async (e) => {
          if (!(e instanceof TagError && e.code === 'used') || cancelled.current) throw e;
          await pause();
          return '';
        });
      }
      setIds([...ids, id]);
    } catch (e) {
      setPaused(true);
      if (!cancelled.current) setError(e instanceof TagError ? e.message : 'Lost the tag. Hold it still and try again.');
    }
    setBusy('');
  };

  // the real test, so all 3 tags are proven: each one is read back and opened with the PIN, then every
  // pair rebuilds the wallet key exactly as a restore would
  const check = async () => {
    setError('');
    setPaused(false);
    cancelled.current = false;
    setBusy(tested.length ? 'Hold another of your tags to the back' : 'Hold any of your 3 tags to the back');
    try {
      let tag = await readShardBytes();
      // a tag already tested is often still on the phone: wait quietly for another
      while (tested.some((t) => t.id === tag.id || same(shards![t.index], tag.bytes))) {
        await pause();
        tag = await readShardBytes();
      }
      const index = shards!.findIndex((b) => same(b, tag.bytes));
      if (index < 0) throw new Error('That isn’t one of the 3 tags you just wrote.');
      const all = [...tested, { id: tag.id, index, shard: await openShard(tag.bytes, pinFor.current) }];
      if (all.length === 3) {
        const seed = seedOf(getDraft());
        for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
          const back = await combineShards(all[a].shard, all[b].shard).catch(() => null);
          if (!back || !same(back, seed)) throw new Error('These tags don’t bring your wallet back. Write all 3 again on 3 different tags.');
        }
        pinFor.current = '';
        setRecoverable(true);
      }
      setTested(all);
    } catch (e) {
      setPaused(true);
      if (!cancelled.current) setError((e as Error).message || 'Lost the tag. Hold it still and try again.');
    }
    setBusy('');
  };

  useEffect(() => {
    if (!shards || busy || paused) return;
    if (ids.length < 3) void write();
    else if (testing && !recoverable && !skipped) void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- write reads the same state; rerun only when these change
  }, [shards, ids, busy, paused, tested, recoverable, skipped, testing]);

  if (busy) {
    const cancel = () => {
      cancelled.current = true;
      cancelTap();
    };
    const skip = () => {
      setSkipped(true);
      pinFor.current = '';
      cancel();
    };
    if (!shards) return <Screen><Busy message={busy} /></Screen>;
    return (
      <Screen>
        <Intro>{ids.length < 3 ? 'Any 2 of these 3 tags plus your PIN bring your wallet back. Keep them in different places.' : 'Testing your tags: tap each one again, in any order. We rebuild your wallet from them, like a restore would.'}</Intro>
        <Tags written={ids.length} tested={tested.length} tapping />
        <Busy message={busy} hint={ids.length < 3 ? 'We write it, then read it back to check every byte before moving on.' : undefined} onCancel={ids.length < 3 ? cancel : undefined} />
        {ids.length === 3 && <Button kind="link" title="Skip the test, I’m in a hurry" onPress={skip} />}
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

  const done = recoverable || skipped;
  return (
    <Screen>
      <Intro>Any 2 of these 3 tags plus your PIN bring your wallet back. Keep them in different places.</Intro>
      <Tags written={ids.length} tested={tested.length} />
      <ErrorText>{error}</ErrorText>
      {recoverable && (
        <View style={[s.card, { gap: 4, borderColor: Colors.positive, backgroundColor: Colors.positiveSoft }]}>
          <Text style={[Type.heading, { color: Colors.positive }]}>Your 3 tags are tested ✓</Text>
          <Text style={Type.small}>We rebuilt your wallet from every pair of them with your PIN. Any 2 of the 3 bring it back.</Text>
        </View>
      )}
      {ids.length === 3 && !testing && !done && (
        <View style={[s.card, { gap: 4 }]}>
          <Text style={Type.heading}>All 3 tags are written</Text>
          <Text style={Type.small}>Recommended: test them now. You tap each tag once more and we rebuild your wallet from them, so you know any 2 bring it back.</Text>
        </View>
      )}
      {done && (
        <Intro>Keep the 3 tags in 3 different places. Don’t write anything on them: a blank tag gives no clue it belongs to a wallet.</Intro>
      )}
      <View style={{ flex: 1 }} />
      {done ? (
        <Button title="Done" onPress={() => nextBackup(router, 'tags')} />
      ) : (
        <>
          {ids.length < 3 ? (
            <Button title={`Try tag ${ids.length + 1} again`} onPress={write} />
          ) : testing ? (
            <Button title="Continue the test" onPress={check} />
          ) : (
            <Button title="Test my tags" onPress={() => setTesting(true)} />
          )}
          {ids.length === 3 && <Button kind="link" title="Skip the test, I’m in a hurry" onPress={() => { setSkipped(true); pinFor.current = ''; }} />}
        </>
      )}
    </Screen>
  );
}

/**
 * The 3 tag chips, filled in tap order: written, the one to tap now, waiting. The test fills them
 * again the same way. Tags carry no labels, so the count of taps is what the user can follow.
 */
function Tags({ written, tested, tapping }: { written: number; tested: number; tapping?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {[0, 1, 2].map((i) => {
        const at = written < 3 ? written : tested;
        const state = written === 3 && i < tested ? 'done' : i < at || (written === 3 && !tapping) ? 'written' : i === at ? 'next' : 'waiting';
        return (
          <View
            key={i}
            style={[
              s.card,
              // explicit solid: Android keeps a dashed border after the style that set it is gone
              { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: Spacing.sm, borderWidth: 2, borderStyle: 'solid' },
              state === 'done' && { borderColor: Colors.positive, backgroundColor: Colors.positiveSoft },
              state === 'next' && { borderColor: Colors.primary, backgroundColor: Colors.primary },
              state === 'waiting' && { backgroundColor: Colors.surfaceAlt, borderStyle: 'dashed', borderColor: '#CFC3A0' },
            ]}>
            <Icon
              name={state === 'done' ? 'shield-checkmark' : state === 'written' ? 'checkmark' : state === 'next' ? 'radio-outline' : 'tablet-portrait-outline'}
              color={state === 'done' || state === 'written' ? Colors.positive : state === 'next' ? Colors.white : Colors.inkSoft}
            />
            <Text style={[Type.heading, state === 'next' && { color: Colors.white }]}>Tag {i + 1}</Text>
            <Text style={[Type.small, { fontSize: 12 }, (state === 'done' || state === 'written') && { color: Colors.positive }, state === 'next' && { color: Colors.white }]}>
              {state === 'done' ? 'Tested' : state === 'written' ? 'Written' : state === 'next' ? (tapping ? 'Tap now' : 'Next') : 'Waiting'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
