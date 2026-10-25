import { MIN_PIN, createShards } from '@crypto/shards';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Busy, Button, ErrorText, Intro, List, Row, Screen, SecretInput, s } from '@/components/ui';
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
  const [askOverwrite, setAskOverwrite] = useState(false);
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

  const write = async (overwrite = false) => {
    setError('');
    setAskOverwrite(false);
    cancelled.current = false;
    setBusy(`Hold tag ${ids.length + 1} flat against the back of your phone`);
    try {
      const id = await writeVerified(shards![ids.length], ids, overwrite);
      setIds([...ids, id]);
    } catch (e) {
      if (e instanceof TagError && e.code === 'hasData') setAskOverwrite(true);
      else if (!cancelled.current) setError(e instanceof TagError ? e.message : 'Lost the tag. Hold it still and try again.');
    }
    setBusy('');
  };

  if (busy) {
    const cancel = () => {
      cancelled.current = true;
      cancelTap();
    };
    return <Screen><Busy message={busy} onCancel={shards ? cancel : undefined} /></Screen>;
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
      <List>
        {[0, 1, 2].map((i) => (
          <Row
            key={i}
            icon={i < ids.length ? 'checkmark-circle' : 'radio-button-off'}
            tone={i < ids.length ? 'positive' : undefined}
            title={`Tag ${i + 1}`}
            right={i < ids.length ? 'Written and checked' : i === ids.length ? 'Next' : ''}
          />
        ))}
      </List>
      {askOverwrite ? (
        <View style={[s.card, { gap: Spacing.sm }]}>
          <Text style={Type.heading}>This tag already has something on it</Text>
          <Text style={Type.small}>Overwriting erases it for good. If it might be a tag from another backup, use a blank one instead.</Text>
          <Button title="Overwrite it" onPress={() => write(true)} />
          <Button kind="secondary" title="Use another tag" onPress={() => write()} />
        </View>
      ) : (
        <ErrorText>{error}</ErrorText>
      )}
      {done && (
        <Intro>Keep the 3 tags in 3 different places. Don’t write anything on them: a blank tag gives no clue it belongs to a wallet.</Intro>
      )}
      <View style={{ flex: 1 }} />
      {done ? (
        <Button title="Done" onPress={() => nextBackup(router, 'tags')} />
      ) : (
        !askOverwrite && <Button title={`Write tag ${ids.length + 1}`} onPress={() => write()} />
      )}
    </Screen>
  );
}
