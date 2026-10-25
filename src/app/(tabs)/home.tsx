import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActivityRow, fmt } from '@/components/activity-row';
import { ErrorText, Icon, List, Row, Screen, s, type IconName } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { accountExists, network, recentActivity, type Activity } from '@/lib/chain';
import { backUp } from '@/lib/draft';
import { getBackups, getHoldings, getTestXlm, getWallet, isProtected, keepProtection, type Holding } from '@/lib/stellar';

type Status = { holdings: Holding[]; opened: boolean; activity: Activity[]; backedUp: boolean; protectedNow: boolean };

export default function Home() {
  const router = useRouter();
  const [st, setSt] = useState<Status>();
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    const backedUp = (await getBackups()).length > 0;
    try {
      const w = (await getWallet())!;
      setAddress(w.account);
      await keepProtection(); // after a restore of a protected wallet: lock the old phone out
      const [holdings, opened, activity] = await Promise.all([getHoldings(), accountExists(w.account), recentActivity(w.account)]);
      const now = (await getWallet())!;
      setSt({ holdings, opened, activity, backedUp, protectedNow: isProtected(now) });
    } catch (e) {
      setSt((old) => old ?? { holdings: [], opened: true, activity: [], backedUp, protectedNow: false });
      setError(String(e).includes('Network') ? 'Can’t reach Stellar. Check your connection and pull down to refresh.' : String(e));
    }
  }, []);

  // refresh whenever Home comes back into view (after sending, adding a token, …)
  useFocusEffect(useCallback(() => void refresh(), [refresh]));

  const xlm = st?.holdings[0]?.amount;
  return (
    <Screen noHeader onRefresh={refresh}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <Text style={[Type.title, { flex: 1 }]}>Shards</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Network: ${network}`} onPress={() => router.navigate('/settings')}>
          <Text
            style={[
              Type.tiny,
              { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, overflow: 'hidden' },
              network === 'testnet' ? { backgroundColor: Colors.neutralChip } : { backgroundColor: Colors.primarySoft, color: Colors.primary },
            ]}>
            {network.toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {st && !st.backedUp && (
        <List>
          <Row icon="alert-circle" tone="negative" title="Not backed up" detail="If this phone is lost, so is the wallet. Back up now." onPress={() => backUp(router)} />
        </List>
      )}

      <View style={[s.card, { gap: 6, padding: Spacing.xl, borderRadius: Radius.xl, backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
        <Text style={[Type.small, { color: 'rgba(255,255,255,0.75)' }]}>Balance</Text>
        <Text style={[Type.num, { fontSize: 44, color: Colors.white }]}>
          {xlm === undefined ? '…' : fmt(xlm)} <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.75)' }}>XLM</Text>
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
          {!!address && <Text style={styles.chip}>{address.slice(0, 4)}…{address.slice(-4)}</Text>}
          {st?.protectedNow && <Text style={styles.chip}>Protected</Text>}
        </View>
      </View>

      <View style={[s.card, { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: Spacing.sm }]}>
        <Action icon="arrow-up" label="Send" disabled={!xlm} onPress={() => router.push('/send')} />
        <Action icon="arrow-down" label="Receive" onPress={() => router.push('/receive')} />
        <Action icon="add" label="Add token" disabled={!st?.opened} onPress={() => router.push('/tokens')} />
        {network === 'testnet' ? (
          <Action icon="water-outline" label="Test XLM" disabled={st?.opened !== false} onPress={() => getTestXlm().then(refresh, (e) => setError(String(e)))} />
        ) : (
          <Action icon="shield-outline" label="Protect" onPress={() => router.push('/protect')} />
        )}
      </View>

      {st?.opened === false && (
        <Text style={Type.small}>New wallets start empty. Receive your first XLM to open it on Stellar{network === 'testnet' ? ', or tap Test XLM for free test XLM.' : '.'}</Text>
      )}
      <ErrorText>{error}</ErrorText>

      {st?.opened && (
        <List label="TOKENS">
          {st.holdings.map((h) => (
            <Row key={h.token?.code ?? 'XLM'} badge={h.token ? h.token.code[0] : 'X'} title={h.token?.code ?? 'XLM'} detail={h.token?.name ?? 'Stellar Lumens'} right={fmt(h.amount)} />
          ))}
        </List>
      )}

      {!!st?.activity.length && (
        <List label="RECENT ACTIVITY">
          {st.activity.map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
          <Row title="See all" onPress={() => router.navigate('/activity')} />
        </List>
      )}
    </Screen>
  );
}

/** One quick action: round icon over a label. */
function Action({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 6 }, (disabled || pressed) && { opacity: 0.4 }]}>
      <View style={[styles.action]}>
        <Icon name={icon} color={Colors.primary} />
      </View>
      <Text style={[Type.small, { color: Colors.ink, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { fontSize: 12, fontFamily: 'monospace', color: Colors.white, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, overflow: 'hidden' },
  action: { width: 48, height: 48, borderRadius: Radius.full, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
