import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Screen, s } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { needs2fa, server } from '@/lib/chain';
import { startDraft } from '@/lib/draft';
import { ensureRekeyed, getBackups, getWallet, getXlmBalance, isRekeyed, type BackupRecord } from '@/lib/stellar';

const LABEL: Record<BackupRecord['kind'], string> = { phrase: 'Recovery phrase on paper', key: 'Secret key on paper', tags: 'NFC tags' };

export default function Home() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState<number>();
  const [error, setError] = useState('');
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [rekeyed, setRekeyed] = useState<boolean>();
  const [twoFactor, setTwoFactor] = useState<boolean>();

  const refresh = useCallback(async () => {
    setError('');
    try {
      setBalance(await getXlmBalance());
      await ensureRekeyed();
      const w = await getWallet();
      setRekeyed(!!w && isRekeyed(w));
      if (w) setTwoFactor(needs2fa(await server.getAccountEntry(w.account)));
    } catch (e) {
      setError(String(e).includes('Network') ? "Can't reach Stellar. Turn airplane mode off to see your balance." : String(e));
    }
  }, []);

  // refresh whenever Home comes back into view (e.g. after sending)
  useFocusEffect(useCallback(() => void refresh(), [refresh]));

  useEffect(() => {
    getWallet().then((w) => {
      setAddress(w?.account ?? '');
      setRekeyed(!!w && isRekeyed(w));
    });
    getBackups().then(setBackups);
  }, []);

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
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Send" disabled={!balance} onPress={() => router.push('/send')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" title="Refresh" onPress={refresh} />
          </View>
        </View>
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

      {rekeyed ? (
        <View style={[s.card, { gap: 4 }]}>
          <Text style={Type.heading}>This phone has its own key ✓</Text>
          <Text style={Type.small}>It can send, but can’t change who controls the wallet. Your recovery key is only on your backups.</Text>
          {twoFactor ? (
            <Text style={[Type.small, { color: Colors.positive }]}>2FA on: every payment also needs your YubiKey.</Text>
          ) : twoFactor === false ? (
            <Button kind="secondary" title="Turn on 2FA with a YubiKey" onPress={() => router.push('/two-factor')} />
          ) : null}
        </View>
      ) : (
        <>
          {backups.length > 0 && rekeyed === false && (
            <Text style={Type.small}>Next time you’re online, this phone gets its own key and the recovery key is removed from it.</Text>
          )}
          {/* ponytail: needs the recovery key, so only before re-key; after it, restore from paper/tags first */}
          <Button
            kind="secondary"
            title={backups.some((b) => b.kind === 'tags') ? 'Write new NFC tags' : 'Back up to NFC tags'}
            onPress={async () => {
              // works for any wallet, created here or imported: tags hold the same key either way
              const w = (await getWallet())!;
              if (isRekeyed(w)) return; // the device key on tags would restore nothing
              startDraft({ rawSeed: w.signer.rawSecretKey(), imported: false });
              router.push('/backup-tags');
            }}
          />
        </>
      )}

      <View style={{ flex: 1, minHeight: Spacing.xl }} />
      <Link href="/nfc-check" style={[Type.small, { textAlign: 'center', padding: Spacing.md }]}>NFC test (dev)</Link>
    </Screen>
  );
}
