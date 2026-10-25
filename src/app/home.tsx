import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, ErrorText, Icon, List, Row, Screen, s } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { accountExists, needs2fa, network, server } from '@/lib/chain';
import { backUp } from '@/lib/draft';
import { BACKUP_LABEL, getBackups, getTestXlm, getWallet, getXlmBalance, isProtected, keepProtection, type BackupRecord } from '@/lib/stellar';

type Status = { balance?: number; opened?: boolean; backups: BackupRecord[]; protectedNow: boolean; twoFactor: boolean };

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>();
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    const backups = await getBackups();
    try {
      const balance = await getXlmBalance();
      await keepProtection(); // after a restore of a protected wallet: lock the old phone out
      const w = (await getWallet())!;
      const opened = await accountExists(w.account); // a Stellar account exists from its first deposit
      setStatus({ balance, opened, backups, protectedNow: isProtected(w), twoFactor: opened && needs2fa(await server.getAccountEntry(w.account)) });
    } catch (e) {
      const w = await getWallet();
      setStatus((st) => st ?? { backups, protectedNow: !!w && isProtected(w), twoFactor: false });
      setError(String(e).includes('Network') ? 'Can’t reach Stellar. Check your connection and pull down to refresh.' : String(e));
    }
  }, []);

  // refresh whenever Home comes back into view (after sending, protecting, …)
  useFocusEffect(useCallback(() => void refresh(), [refresh]));

  const st = status;
  return (
    <Screen noHeader onRefresh={refresh}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <Text style={[Type.title, { flex: 1 }]}>Shards</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Network: ${network}`} onPress={() => router.push('/settings')}>
          <Text
            style={[
              Type.tiny,
              { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, overflow: 'hidden' },
              network === 'testnet' ? { backgroundColor: Colors.neutralChip } : { backgroundColor: Colors.primarySoft, color: Colors.primary },
            ]}>
            {network.toUpperCase()}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12} onPress={() => router.push('/settings')}>
          <Icon name="settings-outline" />
        </Pressable>
      </View>

      <View style={[s.card, { gap: Spacing.sm }]}>
        <Text style={Type.small}>Balance</Text>
        <Text style={[Type.num, { fontSize: 44 }]}>
          {st?.balance === undefined ? '…' : st.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
          <Text style={{ fontSize: 20, color: Colors.inkSoft }}>XLM</Text>
        </Text>
        {st?.opened === false && (
          <Text style={Type.small}>
            New wallets start empty. Receive your first XLM to open it on Stellar{network === 'testnet' ? ', or get free test XLM.' : '.'}
          </Text>
        )}
        <ErrorText>{error}</ErrorText>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Send" disabled={!st?.balance} onPress={() => router.push('/send')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" title="Receive" onPress={() => router.push('/receive')} />
          </View>
        </View>
        {st?.opened === false && network === 'testnet' && (
          <Button kind="link" title="Get 10,000 test XLM" onPress={() => getTestXlm().then(refresh, (e) => setError(String(e)))} />
        )}
      </View>

      {st && (
        <List label="SECURITY">
          {st.backups.length ? (
            <Row icon="checkmark-circle" tone="positive" title="Backed up" detail={st.backups.map((b) => BACKUP_LABEL[b.kind]).join(' · ')} onPress={() => router.push('/settings')} />
          ) : (
            <Row icon="alert-circle" tone="negative" title="Not backed up" detail="If this phone is lost, so is the wallet." onPress={() => backUp(router)} />
          )}
          {st.protectedNow ? (
            <Row
              icon="shield-checkmark"
              tone="positive"
              title="Phone protected"
              detail={st.twoFactor ? 'Payments also need your YubiKey' : 'YubiKey 2FA off'}
              onPress={() => router.push('/protect')}
            />
          ) : (
            <Row icon="shield-outline" tone="accent" title="Protect this wallet" detail="Limit what a stolen phone can do" onPress={() => router.push('/protect')} />
          )}
        </List>
      )}
    </Screen>
  );
}
