import { StrKey, type Transaction } from '@stellar/stellar-sdk';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { Button, Screen, SecretInput, s } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { accountExists, cosignersOf, needs2fa, paymentTx, server, spendable, submit } from '@/lib/chain';
import { getWallet } from '@/lib/stellar';
import { signWithYubiKey } from '@/lib/yubikey';

const AMOUNT = /^\d+(\.\d{1,7})?$/; // Stellar amounts have 7 decimals
const memoBytes = (m: string) => new TextEncoder().encode(m).length;

export default function Send() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [max, setMax] = useState<number>();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [review, setReview] = useState<{ tx: Transaction; creates: boolean; factors: string[] }>();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  useEffect(() => {
    getWallet().then(async (w) => {
      setAccount(w!.account);
      setMax(spendable(await server.getAccountEntry(w!.account)));
    }, (e) => setError(String(e)));
  }, []);

  const dest = to.trim().toUpperCase();
  const problem =
    dest && !StrKey.isValidEd25519PublicKey(dest) ? 'That isn’t a Stellar address (G…, 56 characters).'
    : dest === account ? 'That’s this wallet’s own address.'
    : amount && !AMOUNT.test(amount) ? 'Use a number with up to 7 decimals.'
    : amount && max !== undefined && Number(amount) > max ? `You can send up to ${max.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM.`
    : memoBytes(memo) > 28 ? 'The memo can be at most 28 characters.'
    : '';
  const ready = !problem && StrKey.isValidEd25519PublicKey(dest) && Number(amount) > 0;

  const prepare = async () => {
    setError('');
    setBusy('Checking…');
    try {
      const creates = !(await accountExists(dest));
      if (creates && Number(amount) < 1) throw new Error('That address has no account yet. The first payment to it must be at least 1 XLM.');
      const entry = await server.getAccountEntry(account);
      setReview({ tx: await paymentTx(account, dest, amount, memo), creates, factors: needs2fa(entry) ? cosignersOf(entry) : [] });
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy('');
  };

  const send = async () => {
    setError('');
    setBusy('Sending…');
    try {
      const { tx, factors } = review!;
      if (factors.length) {
        setBusy('Hold your YubiKey flat against the back of your phone');
        const { address, signature } = await signWithYubiKey(tx.hash(), pin);
        if (!factors.includes(address)) throw new Error('That YubiKey isn’t one of this wallet’s second factors.');
        tx.addSignature(address, Buffer.from(signature).toString('base64'));
        setBusy('Sending…');
      }
      tx.sign((await getWallet())!.signer);
      await submit(tx);
      setSent(Buffer.from(tx.hash()).toString('hex'));
    } catch (e) {
      // a half-signed transaction can't be retried as is; Review builds a fresh one
      setReview(undefined);
      setError((e as Error).message || 'Lost the YubiKey. Hold it still and try again.');
    }
    setBusy('');
  };

  if (busy) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={Type.heading}>{busy}</Text>
        </View>
      </Screen>
    );
  }

  if (sent) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: Spacing.md }}>
          <Text style={[Type.title, { textAlign: 'center' }]}>Sent ✓</Text>
          <Text style={[Type.body, { textAlign: 'center' }]}>{amount} XLM is on its way.</Text>
          <Text selectable style={[Type.small, { textAlign: 'center', fontFamily: 'monospace' }]}>{sent}</Text>
        </View>
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (review) {
    return (
      <Screen>
        <View style={[s.card, { gap: Spacing.sm }]}>
          <Text style={Type.small}>Send</Text>
          <Text style={[Type.num, { fontSize: 32 }]}>{amount} XLM</Text>
          <Text style={Type.small}>To</Text>
          <Text selectable style={[Type.body, { fontFamily: 'monospace' }]}>{dest.match(/.{1,4}/g)!.join(' ')}</Text>
          {!!memo && <Text style={Type.small}>Memo: {memo}</Text>}
          <Text style={Type.small}>Network fee: 0.0001 XLM</Text>
          {review.creates && <Text style={[Type.small, { color: Colors.accent }]}>This address is new to Stellar; this payment opens its account.</Text>}
        </View>
        <Text style={Type.small}>Check the first and last characters of the address against where you copied it from.</Text>
        {review.factors.length > 0 && (
          <SecretInput secureTextEntry keyboardType="number-pad" placeholder="YubiKey PIN" value={pin} onChangeText={setPin} />
        )}
        {!!error && <Text style={[Type.small, { color: Colors.negative }]}>{error}</Text>}
        <View style={{ flex: 1 }} />
        <Button
          title={review.factors.length ? `Tap YubiKey and send ${amount} XLM` : `Send ${amount} XLM`}
          disabled={review.factors.length > 0 && pin.length < 6}
          onPress={send}
        />
        <Button kind="link" title="Change" onPress={() => setReview(undefined)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={s.label}>TO</Text>
      <TextInput style={[s.input, { fontFamily: 'monospace' }]} value={to} onChangeText={setTo} placeholder="G…" autoCapitalize="characters" autoCorrect={false} multiline />
      <Text style={s.label}>AMOUNT (XLM)</Text>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
        <TextInput style={[s.input, { flex: 1 }]} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" />
        {max !== undefined && <Button kind="link" title="Max" onPress={() => setAmount(String(Math.floor(max * 1e7) / 1e7))} />}
      </View>
      {max !== undefined && <Text style={Type.small}>Available: {max.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM</Text>}
      <Text style={s.label}>MEMO (OPTIONAL)</Text>
      <TextInput style={s.input} value={memo} onChangeText={setMemo} placeholder="Exchanges often require one" />
      {!!(problem || error) && <Text style={[Type.small, { color: Colors.negative }]}>{problem || error}</Text>}
      <View style={{ flex: 1 }} />
      <Button title="Review" disabled={!ready} onPress={prepare} />
    </Screen>
  );
}
