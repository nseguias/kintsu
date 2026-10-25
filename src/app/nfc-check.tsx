// ponytail: dev-only hardware checks (NFC tags, native scrypt); not part of the user flow.
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ndef } from 'react-native-nfc-manager';
import { scrypt as nativeScrypt } from 'react-native-quick-crypto';
import { scrypt } from '@crypto/kdf';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { Asset, Operation } from '@stellar/stellar-sdk';

import { newTx, submit } from '@/lib/chain';
import { forgetWallet, getWallet } from '@/lib/stellar';
import { setupYubiKey, signWithYubiKey } from '@/lib/yubikey';
import { cancelTap, readRecords, simulated, textOf, writeRecords } from '@/lib/nfc';

export default function NfcCheck() {
  const router = useRouter();
  const [text, setText] = useState('hello shards');
  const [status, setStatus] = useState('Idle');
  const [sim, setSim] = useState(false);
  const [pin, setPin] = useState('123456'); // ponytail: testnet dev screen; factory-default OpenPGP PINs
  const [adminPin, setAdminPin] = useState('12345678');
  const [yubi, setYubi] = useState('');
  useEffect(() => void simulated.then(setSim), []);

  const run = (label: string, fn: () => Promise<string>) => async () => {
    setStatus(`${label}: hold the tag to the back of the phone…`);
    try {
      setStatus(await fn());
    } catch (e) {
      setStatus(`${label} failed: ${String(e)}`);
    }
  };

  const write = run('Write', async () => {
    await writeRecords([Ndef.textRecord(text)]);
    return `Wrote "${text}"`;
  });

  const read = run('Read', async () => {
    const { id, techTypes, records } = await readRecords();
    const texts = records.map(textOf);
    return `Tag ${id}\n${techTypes?.join(', ')}\n\n${texts.length ? texts.map((t) => `"${t}"`).join('\n') : '(empty)'}`
      + (texts.includes(text) ? '\n\n✅ matches what you typed' : '');
  });

  const kdf = run('scrypt', async () => {
    // RFC 7914 §12 vector (N=16384 r=8 p=1), first 32 bytes
    const rfc = await new Promise<string>((ok, fail) =>
      nativeScrypt('pleaseletmein', 'SodiumChloride', 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? fail(e) : ok(k!.toString('hex')))),
    );
    const t = Date.now();
    await scrypt('123456', new Uint8Array(16));
    const ms = Date.now() - t;
    return `${rfc === '7023bdcb3afd7348461c06cd81fd38ebfda8fbba904f8e3ea9b543f6545da1f2' ? '✅' : '❌'} RFC 7914 vector\n${ms} ms per tag (N=2^15)`;
  });

  const setup = run('YubiKey', async () => {
    const address = await setupYubiKey(adminPin);
    setYubi(address);
    return `YubiKey address\n${address}`;
  });

  // the Mac test, over NFC: a real testnet payment from the YubiKey's own account to this wallet
  const yubiPay = run('YubiKey', async () => {
    const to = (await getWallet())!.account;
    const tx = (await newTx(yubi)).addOperation(Operation.payment({ destination: to, asset: Asset.native(), amount: '1' })).build();
    setStatus('YubiKey: hold it flat against the back of the phone…');
    const { signature } = await signWithYubiKey(tx.hash(), pin, yubi);
    tx.addSignature(yubi, Buffer.from(signature).toString('base64'));
    await submit(tx);
    return `✅ Testnet accepted 1 XLM signed by the YubiKey\n${Buffer.from(tx.hash()).toString('hex').slice(0, 16)}…`;
  });

  return (
    <View style={styles.root}>
      {sim && <Text style={[Type.small, { color: Colors.accent }]}>No NFC hardware: using a simulated tag.</Text>}
      <TextInput style={styles.input} value={text} onChangeText={setText} />
      <Pressable style={styles.btn} onPress={write}><Text style={styles.btnText}>Write text record</Text></Pressable>
      <Pressable style={styles.btn} onPress={read}><Text style={styles.btnText}>Read tag</Text></Pressable>
      <Pressable style={styles.btn} onPress={kdf}><Text style={styles.btnText}>Check scrypt</Text></Pressable>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={pin} onChangeText={setPin} placeholder="PIN" />
        <TextInput style={[styles.input, { flex: 1 }]} value={adminPin} onChangeText={setAdminPin} placeholder="Admin PIN" />
      </View>
      <Pressable style={styles.btn} onPress={setup}><Text style={styles.btnText}>Set up YubiKey</Text></Pressable>
      {!!yubi && <Pressable style={styles.btn} onPress={yubiPay}><Text style={styles.btnText}>Send 1 XLM signed by the YubiKey</Text></Pressable>}
      <Pressable onPress={cancelTap}><Text style={[Type.small, { textAlign: 'center' }]}>Cancel</Text></Pressable>
      <Text selectable style={[Type.body, { marginTop: Spacing.lg }]}>{status}</Text>
      {/* ponytail: dev-only stand-in for wiping the app; a real wipe also clears the emulator's simulated tags */}
      <Pressable
        onPress={async () => {
          await forgetWallet();
          if (router.canDismiss()) router.dismissAll();
          router.replace('/');
        }}>
        <Text style={[Type.small, { textAlign: 'center', color: Colors.negative, marginTop: Spacing.xl }]}>Forget wallet (dev)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  input: { backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, ...Type.body },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.md, alignItems: 'center' },
  btnText: { color: Colors.white, fontWeight: '600' },
});
