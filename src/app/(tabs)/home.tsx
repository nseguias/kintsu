import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActivityRow, fmt } from '@/components/activity-row';
import { ErrorText, Icon, List, Row, Screen, Segmented, s, type IconName } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { accountExists, network, recentActivity, type Activity } from '@/lib/chain';
import { backUp } from '@/lib/draft';
import { getBackups, getHoldings, getTestXlm, getWallet, isProtected, keepProtection, type Holding } from '@/lib/stellar';

type Status = { holdings: Holding[]; opened: boolean; activity: Activity[]; backedUp: boolean; protectedNow: boolean };
const ROW = 72; // every row in the Home list is this tall, so we can show only the ones that fit whole

export default function Home() {
  const router = useRouter();
  const [st, setSt] = useState<Status>();
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [tab, setTab] = useState<'tokens' | 'activity'>('tokens');
  const [space, setSpace] = useState(0);

  const refresh = useCallback(async () => {
    setError('');
    const backedUp = (await getBackups()).length > 0;
    try {
      const w = (await getWallet())!;
      setAddress(w.account);
      await keepProtection(); // after a restore of a protected wallet: lock the old phone out
      const [holdings, opened, activity] = await Promise.all([getHoldings(), accountExists(w.account), recentActivity(w.account, 20)]);
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
  const rows =
    tab === 'tokens'
      ? (st?.holdings ?? []).map((h) => (
          <Row
            key={h.token ? `${h.token.code}:${h.token.issuer}` : 'XLM'}
            oneLine
            badge={h.token ? h.token.code[0] : 'X'}
            title={h.token?.code ?? 'XLM'}
            detail={h.token?.name ?? 'Stellar Lumens'}
            right={fmt(h.amount)}
          />
        ))
      : (st?.activity ?? []).map((a) => <ActivityRow key={a.id} a={a} />);
  // whole rows only: when they don't all fit, the last slot becomes "See all"
  const fits = Math.max(1, Math.floor(space / ROW));
  const shown = rows.length > fits ? rows.slice(0, fits - 1) : rows;
  const more = rows.length > fits && (
    <Row
      key="more"
      icon={tab === 'tokens' ? 'wallet-outline' : 'time-outline'}
      title={tab === 'tokens' ? `See all ${rows.length} tokens` : 'See all activity'}
      onPress={() => (tab === 'tokens' ? router.push('/tokens') : router.navigate('/activity'))}
    />
  );

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
          <Row icon="alert-circle" tone="negative" title="Not backed up" detail="If this phone is lost, so is the wallet." onPress={() => backUp(router)} />
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

      <View style={{ flexDirection: 'row' }}>
        <Action icon="arrow-up" label="Send" disabled={!xlm} onPress={() => router.push('/send')} />
        <Action icon="arrow-down" label="Receive" onPress={() => router.push('/receive')} />
        <Action icon="add" label="Add token" disabled={!st?.opened} onPress={() => router.push('/tokens')} />
        {network === 'testnet' ? (
          <Action icon="water" label="Test XLM" disabled={st?.opened !== false} onPress={() => getTestXlm().then(refresh, (e) => setError(String(e)))} />
        ) : (
          <Action icon="shield-checkmark" label="Protect" onPress={() => router.push('/protect')} />
        )}
      </View>

      {st?.opened === false && (
        <Text style={Type.small}>New wallets start empty. Receive your first XLM to open it on Stellar{network === 'testnet' ? ', or tap Test XLM for free test XLM.' : '.'}</Text>
      )}
      <ErrorText>{error}</ErrorText>

      {st?.opened && (
        <>
          <Segmented options={[{ label: 'Tokens', value: 'tokens' }, { label: 'Activity', value: 'activity' }]} value={tab} onChange={setTab} />
          <View style={{ flex: 1, minHeight: ROW }} onLayout={(e) => setSpace(e.nativeEvent.layout.height)}>
            {rows.length ? (
              <List>
                {[...shown, more].filter(Boolean).map((r, i) => (
                  <View key={i} style={{ height: ROW, justifyContent: 'center' }}>
                    {r}
                  </View>
                ))}
              </List>
            ) : (
              <Text style={Type.small}>No payments yet.</Text>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

/** One quick action: a green circle over a label. */
function Action({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 6 }, (disabled || pressed) && { opacity: 0.4 }]}>
      <View style={styles.action}>
        <Icon name={icon} color={Colors.white} />
      </View>
      <Text style={[Type.small, { color: Colors.ink, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { fontSize: 12, fontFamily: 'monospace', color: Colors.white, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, overflow: 'hidden' },
  action: { width: 52, height: 52, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
