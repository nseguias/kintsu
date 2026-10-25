import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ActivityRow, fmt } from '@/components/activity-row';
import { Button, ErrorText, Icon, List, Row, Screen, s } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { accountExists, network, recentActivity, type Activity } from '@/lib/chain';
import { backUp } from '@/lib/draft';
import { getBackups, getHoldings, getTestXlm, getWallet, isProtected, keepProtection, type Holding } from '@/lib/stellar';

type Status = { holdings: Holding[]; opened: boolean; activity: Activity[]; backedUp: boolean; protectedNow: boolean };

export default function Home() {
  const router = useRouter();
  const [st, setSt] = useState<Status>();
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    const backedUp = (await getBackups()).length > 0;
    try {
      const w = (await getWallet())!;
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
        {st?.protectedNow && <Icon name="shield-checkmark" color={Colors.positive} size={18} />}
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

      {st && !st.backedUp && (
        <List>
          <Row icon="alert-circle" tone="negative" title="Not backed up" detail="If this phone is lost, so is the wallet. Back up now." onPress={() => backUp(router)} />
        </List>
      )}

      <View style={[s.card, { gap: Spacing.sm }]}>
        <Text style={Type.small}>Balance</Text>
        <Text style={[Type.num, { fontSize: 44 }]}>
          {xlm === undefined ? '…' : fmt(xlm)} <Text style={{ fontSize: 20, color: Colors.inkSoft }}>XLM</Text>
        </Text>
        {st?.opened === false && (
          <Text style={Type.small}>
            New wallets start empty. Receive your first XLM to open it on Stellar{network === 'testnet' ? ', or get free test XLM.' : '.'}
          </Text>
        )}
        <ErrorText>{error}</ErrorText>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Send" disabled={!xlm} onPress={() => router.push('/send')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" title="Receive" onPress={() => router.push('/receive')} />
          </View>
        </View>
        {st?.opened === false && network === 'testnet' && (
          <Button kind="link" title="Get 10,000 test XLM" onPress={() => getTestXlm().then(refresh, (e) => setError(String(e)))} />
        )}
      </View>

      {st?.opened && (
        <List label="TOKENS">
          {st.holdings.map((h) => (
            <Row key={h.token?.code ?? 'XLM'} badge={h.token ? h.token.code[0] : '✦'} title={h.token?.code ?? 'XLM'} detail={h.token?.name ?? 'Stellar Lumens'} right={fmt(h.amount)} />
          ))}
          <Row icon="add-circle-outline" title="Add a token" detail="USDC, EURC" onPress={() => router.push('/tokens')} />
        </List>
      )}

      {!!st?.activity.length && (
        <List label="RECENT ACTIVITY">
          {st.activity.map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
          <Row icon="time-outline" title="See all" onPress={() => router.push('/activity')} />
        </List>
      )}
    </Screen>
  );
}
