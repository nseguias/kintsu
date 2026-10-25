import { Link, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Screen, s } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { startDraft } from '@/lib/draft';
import { getBackups, getKeypair, getXlmBalance, type BackupRecord } from '@/lib/stellar';

const LABEL: Record<BackupRecord['kind'], string> = { phrase: 'Recovery phrase on paper', key: 'Secret key on paper', tags: 'NFC tags' };

export default function Home() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState<number>();
  const [error, setError] = useState('');
  const [backups, setBackups] = useState<BackupRecord[]>([]);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setBalance(await getXlmBalance());
    } catch (e) {
      setError(String(e).includes('Network') ? "Can't reach Stellar. Turn airplane mode off to see your balance." : String(e));
    }
  }, []);

  useEffect(() => {
    getKeypair().then((kp) => setAddress(kp?.publicKey() ?? ''));
    getBackups().then(setBackups);
    refresh();
  }, [refresh]);

  return (
    <Screen noHeader>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[Type.title, { fontWeight: '700' }]}>Shards</Text>
        <Text style={[Type.tiny, { backgroundColor: Colors.neutralChip, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full }]}>TESTNET</Text>
      </View>

      <View style={[s.card, { gap: 6, borderRadius: Radius.xl }]}>
        <Text style={Type.small}>Balance</Text>
        <Text style={[Type.num, { fontSize: 44 }]}>
          {balance === undefined ? '…' : balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} <Text style={{ fontSize: 20, color: Colors.inkSoft }}>XLM</Text>
        </Text>
        <Text selectable style={[Type.small, { fontFamily: 'monospace' }]}>{address}</Text>
        {!!error && <Text style={[Type.small, { color: Colors.negative }]}>{error}</Text>}
        <Button kind="secondary" title="Refresh" onPress={refresh} />
      </View>

      <Text style={s.label}>BACKUPS</Text>
      {backups.length ? (
        backups.map((b) => (
          <View key={b.kind} style={[s.card, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <Text style={Type.heading}>{LABEL[b.kind]}</Text>
            <Text style={Type.small}>{new Date(b.at).toLocaleDateString()}</Text>
          </View>
        ))
      ) : (
        <View style={[s.card, { backgroundColor: Colors.accentSoft, borderColor: Colors.accent }]}>
          <Text style={Type.heading}>Not backed up</Text>
          <Text style={Type.small}>If this phone is lost, so is the wallet.</Text>
        </View>
      )}

      <Button
        kind="secondary"
        title={backups.some((b) => b.kind === 'tags') ? 'Write new NFC tags' : 'Back up to NFC tags'}
        onPress={async () => {
          // works for any wallet, created here or imported: tags hold the same key either way
          startDraft({ rawSeed: (await getKeypair())!.rawSecretKey(), imported: false });
          router.push('/backup-tags');
        }}
      />

      <View style={{ flex: 1, minHeight: Spacing.xl }} />
      <Link href="/nfc-check" style={[Type.small, { textAlign: 'center', padding: Spacing.md }]}>NFC test (dev)</Link>
    </Screen>
  );
}
