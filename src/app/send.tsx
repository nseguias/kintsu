import { StrKey, type Transaction } from '@stellar/stellar-sdk';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text, TextInput } from '@/components/text';
import { fmt } from '@/components/activity-row';
import { Busy, Button, ErrorText, Icon, Intro, Screen, SecretInput, Segmented, s } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { accountExists, needs2fa, parsePaymentQr, paymentTx, server, spendable } from '@/lib/chain';
import { approve, getHoldings, getWallet, type Holding } from '@/lib/stellar';

const AMOUNT = /^\d+(\.\d{1,7})?$/; // Stellar amounts have 7 decimals
const memoBytes = (m: string) => new TextEncoder().encode(m).length;

export default function Send() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [xlmMax, setXlmMax] = useState<number>();
  const [xlmHeld, setXlmHeld] = useState(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [code, setCode] = useState('XLM');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [review, setReview] = useState<{ tx: Transaction; creates: boolean; yubikey: boolean }>();
  const [pin, setPin] = useState('');
  const [askPin, setAskPin] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    getWallet().then(async (w) => {
      setAccount(w!.account);
      const entry = await server.getAccountEntry(w!.account);
      setXlmMax(spendable(entry));
      setXlmHeld(Number(entry.balance) / 1e7 - spendable(entry));
      setHoldings(await getHoldings());
    }, (e) => setError(String(e)));
  }, []);

  const token = holdings.find((h) => h.token?.code === code)?.token;
  const max = token ? holdings.find((h) => h.token === token)!.amount : xlmMax;

  const dest = to.trim().toUpperCase();
  const problem =
    dest && !StrKey.isValidEd25519PublicKey(dest) ? 'That isn’t a Stellar address (G…, 56 characters).'
    : dest === account ? 'That’s this wallet’s own address.'
    : amount && !AMOUNT.test(amount) ? 'Use a number with up to 7 decimals.'
    : amount && max !== undefined && Number(amount) > max ? `You can send up to ${max.toLocaleString('en-US', { maximumFractionDigits: 7 })} ${code}.`
    : memoBytes(memo) > 28 ? 'The memo can be at most 28 characters.'
    : '';
  const ready = !problem && StrKey.isValidEd25519PublicKey(dest) && Number(amount) > 0;

  const prepare = async () => {
    setError('');
    setBusy('Checking…');
    try {
      const creates = !token && !(await accountExists(dest));
      if (creates && Number(amount) < 1) throw new Error('That address has no account yet. The first payment to it must be at least 1 XLM.');
      const entry = await server.getAccountEntry(account);
      setReview({ tx: await paymentTx(account, dest, amount, memo, token), creates, yubikey: needs2fa(entry) });
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy('');
  };

  const send = async () => {
    setError('');
    setBusy('Sending…');
    try {
      const { tx } = review!;
      await approve(tx, pin, () => setBusy('Hold your YubiKey flat against the back of your phone'));
      router.navigate({ pathname: '/home', params: { done: 'Sent', doneDetail: `${amount} ${code} to ${dest.slice(0, 6)}…${dest.slice(-6)}` } });
    } catch (e) {
      // a half-signed transaction can't be retried as is; Review builds a fresh one
      setReview(undefined);
      setAskPin(false);
      setPin('');
      setError((e as Error).message || 'Lost the YubiKey. Hold it still and try again.');
    }
    setBusy('');
  };

  const scanned = (data: string) => {
    const req = parsePaymentQr(data);
    if (!req) return setScanNote('That QR code isn’t a Stellar address. Try another.');
    setTo(req.to);
    if (req.amount) setAmount(req.amount);
    if (req.memo) setMemo(req.memo);
    setScanning(false);
    setScanNote('');
  };

  if (scanning) {
    return (
      <Screen>
        {!permission?.granted ? (
          <Button title="Allow camera to scan" onPress={requestPermission} />
        ) : (
          <CameraView
            style={{ flex: 1, borderRadius: Radius.lg }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => scanned(data)}
          />
        )}
        <Text style={[Type.small, { textAlign: 'center', color: scanNote ? Colors.negative : Colors.inkSoft }]}>
          {scanNote || 'Point the camera at the receiver’s QR code.'}
        </Text>
        <Button kind="secondary" title="Cancel" onPress={() => setScanning(false)} />
      </Screen>
    );
  }

  if (busy) return <Screen><Busy message={busy} /></Screen>;

  if (review && askPin) {
    return (
      <Screen>
        <Text style={Type.title}>Your YubiKey PIN</Text>
        <Intro>Then hold your YubiKey to the back of the phone to approve {amount} {code}.</Intro>
        <SecretInput secureTextEntry autoFocus placeholder="YubiKey PIN" value={pin} onChangeText={setPin} />
        <View style={{ flex: 1 }} />
        <Button title="Tap your YubiKey" disabled={pin.length < 6} onPress={send} />
        <Button kind="link" title="Back" onPress={() => setAskPin(false)} />
      </Screen>
    );
  }

  if (review) {
    return (
      <Screen>
        <View style={[s.card, { gap: Spacing.sm }]}>
          <Text style={Type.small}>Send</Text>
          <Text style={[Type.num, { fontSize: 32 }]}>{amount} {code}</Text>
          <Text style={Type.small}>To</Text>
          <Text selectable style={Type.mono}>{dest.match(/.{1,4}/g)!.join(' ')}</Text>
          {!!memo && <Text style={Type.small}>Memo: {memo}</Text>}
          <Text style={Type.small}>Network fee: 0.0001 XLM</Text>
          {review.creates && <Text style={[Type.small, { color: Colors.accent }]}>This address is new to Stellar; this payment opens its account.</Text>}
        </View>
        <Text style={Type.small}>Check the first and last characters of the address with the receiver.</Text>
        <ErrorText>{error}</ErrorText>
        <View style={{ flex: 1 }} />
        <Button title={`Send ${amount} ${code}`} onPress={review.yubikey ? () => setAskPin(true) : send} />
        <Button kind="link" title="Change" onPress={() => setReview(undefined)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={s.label}>TO</Text>
      <View style={[s.input, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingRight: 0 }]}>
        <TextInput
          style={[Type.mono, { flex: 1, paddingVertical: Spacing.md }]}
          value={to}
          onChangeText={setTo}
          placeholder="G…"
          placeholderTextColor={Colors.inkFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          multiline
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Scan QR code" onPress={() => setScanning(true)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="qr-code-outline" color={Colors.primary} />
        </Pressable>
      </View>
      {holdings.length > 1 && (
        <>
          <Text style={s.label}>TOKEN</Text>
          <Segmented options={holdings.map((h) => ({ label: h.token?.code ?? 'XLM', value: h.token?.code ?? 'XLM' }))} value={code} onChange={setCode} />
        </>
      )}
      <Text style={s.label}>AMOUNT ({code})</Text>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
        <TextInput style={[s.input, { flex: 1 }]} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" />
        {max !== undefined && <Button kind="link" title="Max" onPress={() => setAmount(String(Math.floor(max * 1e7) / 1e7))} />}
      </View>
      {max !== undefined && (
        <Text style={Type.small}>
          Available: {max.toLocaleString('en-US', { maximumFractionDigits: 7 })} {code}
          {!token && xlmHeld > 0 && ` · ${fmt(xlmHeld)} XLM stays aside: Stellar’s deposit for this wallet, its keys and tokens`}
        </Text>
      )}
      <Text style={s.label}>MEMO (OPTIONAL)</Text>
      <TextInput style={s.input} value={memo} onChangeText={setMemo} placeholder="Exchanges often require one" />
      <ErrorText>{problem || error}</ErrorText>
      <View style={{ flex: 1 }} />
      <Button title="Review" disabled={!ready} onPress={prepare} />
    </Screen>
  );
}
