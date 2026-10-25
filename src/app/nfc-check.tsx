// ponytail: dev-only hardware checks (NFC tags, native scrypt); not part of the user flow.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ndef } from 'react-native-nfc-manager';
import { scrypt as nativeScrypt } from 'react-native-quick-crypto';
import { scrypt } from '@crypto/kdf';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { cancelTap, readRecords, simulated, textOf, writeRecords } from '@/lib/nfc';

export default function NfcCheck() {
  const [text, setText] = useState('hello shards');
  const [status, setStatus] = useState('Idle');
  const [sim, setSim] = useState(false);
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

  return (
    <View style={styles.root}>
      {sim && <Text style={[Type.small, { color: Colors.accent }]}>No NFC hardware: using a simulated tag.</Text>}
      <TextInput style={styles.input} value={text} onChangeText={setText} />
      <Pressable style={styles.btn} onPress={write}><Text style={styles.btnText}>Write text record</Text></Pressable>
      <Pressable style={styles.btn} onPress={read}><Text style={styles.btnText}>Read tag</Text></Pressable>
      <Pressable style={styles.btn} onPress={kdf}><Text style={styles.btnText}>Check scrypt</Text></Pressable>
      <Pressable onPress={cancelTap}><Text style={[Type.small, { textAlign: 'center' }]}>Cancel</Text></Pressable>
      <Text selectable style={[Type.body, { marginTop: Spacing.lg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  input: { backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, ...Type.body },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.md, alignItems: 'center' },
  btnText: { color: Colors.white, fontWeight: '600' },
});
