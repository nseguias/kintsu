// ponytail: step-1 hardware check only; replaced by the real onboarding in step 3.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ndef } from 'react-native-nfc-manager';

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

  return (
    <View style={styles.root}>
      {sim && <Text style={[Type.small, { color: Colors.accent }]}>No NFC hardware: using a simulated tag.</Text>}
      <TextInput style={styles.input} value={text} onChangeText={setText} />
      <Pressable style={styles.btn} onPress={write}><Text style={styles.btnText}>Write text record</Text></Pressable>
      <Pressable style={styles.btn} onPress={read}><Text style={styles.btnText}>Read tag</Text></Pressable>
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
