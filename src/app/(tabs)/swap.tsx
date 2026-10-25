import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { fmt } from '@/components/activity-row';
import { Busy, Button, ErrorText, Icon, Screen, SecretInput, Segmented, s } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { knownTokens, quote, server, spendable, swapTx, type Token } from '@/lib/chain';
import { approve, getHoldings, getWallet, needsYubiKey, type Holding } from '@/lib/stellar';
import type { Asset } from '@stellar/stellar-sdk';

const AMOUNT = /^\d+(\.\d{1,7})?$/; // Stellar amounts have 7 decimals
const SLIPPAGE = 0.01; // the swap fails rather than fill more than 1% below the quote
const keyOf = (t?: Token) => (t ? `${t.code}:${t.issuer}` : 'XLM');

export default function Swap() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [xlmFree, setXlmFree] = useState(0);
  const [yubikey, setYubikey] = useState(false);
  const [from, setFrom] = useState('XLM');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [q, setQ] = useState<{ amount: number; path: Asset[] } | null>();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const w = (await getWallet())!;
      setAccount(w.account);
      const held = await getHoldings();
      setHoldings(held);
      if (held[0].amount > 0) setXlmFree(spendable(await server.getAccountEntry(w.account)));
      setYubikey(await needsYubiKey());
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  // what you can pay with: XLM and every token you hold; what you can get: XLM and the checked tokens
  const payable = holdings.filter((h) => !h.token || h.amount > 0);
  const gettable: (Token | undefined)[] = [undefined, ...knownTokens()].filter((t) => keyOf(t) !== from);
  const fromToken = payable.find((h) => keyOf(h.token) === from)?.token;
  const toKey = gettable.some((t) => keyOf(t) === to) ? to : keyOf(gettable[0]);
  const toToken = gettable.find((t) => keyOf(t) === toKey);
  const addTo = !!toToken && !holdings.some((h) => keyOf(h.token) === toKey);
  const fromCode = fromToken?.code ?? 'XLM';
  const toCode = toToken?.code ?? 'XLM';
  const max = fromToken ? payable.find((h) => keyOf(h.token) === from)!.amount : Math.max(0, xlmFree - (addTo ? 0.5 : 0));

  // re-quote shortly after the amount or tokens stop changing
  useEffect(() => {
    setQ(undefined);
    if (!AMOUNT.test(amount) || !Number(amount)) return;
    const t = setTimeout(() => quote(fromToken, toToken, Number(amount)).then(setQ, () => setQ(null)), 400);
    return () => clearTimeout(t);
  }, [amount, from, toKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const problem =
    amount && !AMOUNT.test(amount) ? 'Use a number with up to 7 decimals.'
    : amount && Number(amount) > max ? `You can swap up to ${fmt(max)} ${fromCode}${addTo && !fromToken ? ` (0.5 XLM stays aside for ${toCode})` : ''}.`
    : q === null ? `Nobody is trading ${fromCode} for ${toCode} right now.`
    : '';
  const ready = !problem && !!q && (!yubikey || pin.length >= 6);

  const swap = async () => {
    setError('');
    setBusy('Swapping…');
    try {
      const tx = await swapTx(account, fromToken, toToken, amount, q!.amount * (1 - SLIPPAGE), q!.path, addTo);
      await approve(tx, pin, () => setBusy('Hold your YubiKey flat against the back of your phone'));
      setAmount('');
      router.navigate({ pathname: '/home', params: { done: 'Swap complete', doneDetail: `${amount} ${fromCode} → about ${fmt(q!.amount)} ${toCode}` } });
    } catch (e) {
      setError((e as Error).message || 'Lost the YubiKey. Hold it still and try again.');
    }
    setPin('');
    setBusy('');
  };

  if (busy) return <Screen><Busy message={busy} /></Screen>;

  const flip = () => {
    if (!payable.some((h) => keyOf(h.token) === toKey)) return;
    setTo(from);
    setFrom(toKey);
    setAmount('');
  };

  return (
    <Screen>
      <View style={[s.card, { gap: Spacing.md }]}>
        <Text style={s.label}>YOU PAY</Text>
        <Segmented options={payable.map((h) => ({ label: h.token?.code ?? 'XLM', value: keyOf(h.token) }))} value={from} onChange={(k) => { setFrom(k); setAmount(''); }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <TextInput
            style={[Type.num, { flex: 1, fontSize: 36, padding: 0 }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={Colors.inkFaint}
            keyboardType="decimal-pad"
          />
          <Button kind="link" title="Max" onPress={() => setAmount(String(Math.floor(max * 1e7) / 1e7))} />
        </View>
        <Text style={Type.small}>Available: {fmt(max)} {fromCode}</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Swap direction" onPress={flip} style={{ alignSelf: 'center', marginVertical: -Spacing.lg - 6, zIndex: 1, width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: Colors.background }}>
        <Icon name="swap-vertical" color={Colors.white} size={20} />
      </Pressable>

      <View style={[s.card, { gap: Spacing.md }]}>
        <Text style={s.label}>YOU GET</Text>
        <Segmented options={gettable.map((t) => ({ label: t?.code ?? 'XLM', value: keyOf(t) }))} value={toKey} onChange={setTo} />
        <Text style={[Type.num, { fontSize: 36, color: q ? Colors.ink : Colors.inkFaint }]} numberOfLines={1} adjustsFontSizeToFit>
          {q ? `≈ ${fmt(q.amount)}` : amount && q === undefined && AMOUNT.test(amount) ? '…' : '0'}
        </Text>
        {!!q && (
          <Text style={Type.small}>
            1 {fromCode} ≈ {(q.amount / Number(amount)).toLocaleString(undefined, { maximumSignificantDigits: 4 })} {toCode} · at least {fmt(q.amount * (1 - SLIPPAGE))} {toCode}
          </Text>
        )}
      </View>

      {addTo && <Text style={Type.small}>This also adds {toCode} to your wallet: Stellar sets aside 0.5 XLM while you keep it.</Text>}
      {yubikey && !!q && <SecretInput secureTextEntry placeholder="YubiKey PIN" value={pin} onChangeText={setPin} />}
      <ErrorText>{problem || error}</ErrorText>
      <View style={{ flex: 1 }} />
      <Button title={yubikey ? 'Tap your YubiKey to swap' : 'Swap'} disabled={!ready} onPress={swap} />
    </Screen>
  );
}
