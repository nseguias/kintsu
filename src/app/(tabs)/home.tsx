import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fmt, money } from '@/components/activity-row';
import { ErrorText, Icon, List, Row, Screen, s, type IconName } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { accountExists, network, type Currency } from '@/lib/chain';
import { backUp } from '@/lib/draft';
import { getBackups, getCurrency, getHoldings, getTestXlm, getWallet, keepProtection, valuesIn, type Holding } from '@/lib/stellar';

type Status = { holdings: Holding[]; values: (number | null)[]; currency: Currency; opened: boolean; backedUp: boolean };
const ROW = 72; // every row in the Home list is this tall, so we can show only the ones that fit whole

export default function Home() {
  const router = useRouter();
  // Send and Swap come back here with a one-line confirmation, shown for a few seconds
  const { done, doneDetail } = useLocalSearchParams<{ done?: string; doneDetail?: string }>();
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => router.setParams({ done: undefined, doneDetail: undefined }), 5000);
    return () => clearTimeout(t);
  }, [done, router]);
  const [st, setSt] = useState<Status>();
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [space, setSpace] = useState(0);

  const refresh = useCallback(async () => {
    setError('');
    const backedUp = (await getBackups()).length > 0;
    try {
      const w = (await getWallet())!;
      setAddress(w.account);
      await keepProtection(); // after a restore of a protected wallet: lock the old phone out
      const [holdings, opened, currency] = await Promise.all([getHoldings(), accountExists(w.account), getCurrency()]);
      const values = await valuesIn(holdings, currency);
      setSt({ holdings, values, currency, opened, backedUp });
    } catch (e) {
      setSt((old) => old ?? { holdings: [], values: [], currency: 'USD', opened: true, backedUp });
      setError(String(e).includes('Network') ? 'Can’t reach Stellar. Check your connection and pull down to refresh.' : String(e));
    }
  }, []);

  // refresh whenever Home comes back into view (after sending, adding a token, …)
  useFocusEffect(useCallback(() => void refresh(), [refresh]));

  const xlm = st?.holdings[0]?.amount;
  // tokens at 0 stay listed under Tokens (See all / Add token), not here; XLM always shows
  const total = st?.values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const unpriced = st?.holdings.filter((h, i) => st.values[i] === null).map((h) => h.token?.code ?? 'XLM') ?? [];
  const rows = (st?.holdings ?? []).flatMap((h, i) => (!h.token || h.amount > 0 ? [{ h, value: st!.values[i] }] : [])).map(({ h, value }) => (
    <Row
      key={h.token ? `${h.token.code}:${h.token.issuer}` : 'XLM'}
      oneLine
      badge={h.token ? h.token.code[0] : 'X'}
      title={h.token?.code ?? 'XLM'}
      detail={value !== null && st!.currency !== (h.token?.code ?? 'XLM') ? money(value, st!.currency) : (h.token?.name ?? 'Stellar Lumens')}
      right={`${fmt(h.amount)} ${h.token?.code ?? 'XLM'}`}
    />
  ));
  // whole rows only: when they don't all fit, the last slot becomes "See all"
  const fits = Math.max(1, Math.floor(space / ROW));
  const shown = rows.length > fits ? rows.slice(0, fits - 1) : rows;
  const more = rows.length > fits && <Row key="more" icon="wallet-outline" title={`See all ${st!.holdings.length} tokens`} onPress={() => router.push('/tokens')} />;

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

      {!!done && (
        <List>
          <Row icon="checkmark-circle" tone="positive" title={done} detail={doneDetail} />
        </List>
      )}

      {st && !st.backedUp && (
        <List>
          <Row icon="alert-circle" tone="negative" title="Not backed up" detail="If this phone is lost, so is the wallet." onPress={() => backUp(router)} />
        </List>
      )}

      <View style={[s.card, { gap: 6, padding: Spacing.xl, borderRadius: Radius.xl, backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
        <Text style={[Type.small, { color: 'rgba(255,255,255,0.75)' }]}>Total balance</Text>
        <Text style={[Type.num, { fontSize: 44, color: Colors.white }]} adjustsFontSizeToFit numberOfLines={1}>
          {st && total !== undefined ? money(total, st.currency) : '…'}
        </Text>
        {!!unpriced.length && (
          <Text style={[Type.small, { color: 'rgba(255,255,255,0.75)' }]}>Not counting {unpriced.join(', ')}: no price on Stellar right now</Text>
        )}
        {!!address && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{address.slice(0, 6)}…{address.slice(-6)}</Text>
          </View>
        )}
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
          <Text style={s.label}>TOKENS</Text>
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
              <Text style={Type.small}>No tokens yet.</Text>
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
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start', marginTop: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full },
  chipText: { fontSize: 13, fontFamily: 'monospace', color: Colors.white },
  action: { width: 52, height: 52, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
