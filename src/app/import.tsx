import { isValidMnemonic, wordlist } from '@crypto/mnemonic';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, OfflineOnly, Screen, Segmented, SecretInput, s } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { startDraft } from '@/lib/draft';

export default function Import() {
  usePreventScreenCapture();
  const router = useRouter();
  const [mode, setMode] = useState<'phrase' | 'key'>('phrase');
  const [count, setCount] = useState<12 | 24>(12);
  const [words, setWords] = useState<string[]>(Array(24).fill(''));
  const [pass, setPass] = useState('');
  const [secret, setSecret] = useState('');

  const typed = words.slice(0, count).map((w) => w.trim().toLowerCase());
  const unknown = typed.findIndex((w) => w && !wordlist.includes(w));
  const phrase = typed.join(' ');
  const phraseOk = typed.every(Boolean) && isValidMnemonic(phrase);
  const keyOk = StrKey.isValidEd25519SecretSeed(secret.trim());

  const submit = () => {
    if (mode === 'phrase') startDraft({ mnemonic: phrase, passphrase: pass, imported: true });
    else startDraft({ rawSeed: Keypair.fromSecret(secret.trim()).rawSecretKey(), imported: true });
    router.push('/backup');
  };

  return (
    <Screen>
      <OfflineOnly>
        <Segmented options={[{ label: 'Recovery phrase', value: 'phrase' }, { label: 'Secret key', value: 'key' }]} value={mode} onChange={setMode} />

        {mode === 'phrase' ? (
          <>
            <Segmented options={[{ label: '12 words', value: 12 }, { label: '24 words', value: 24 }]} value={count} onChange={setCount} />
            <View style={[s.card, { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.sm }]}>
              {typed.map((_, i) => (
                <View key={i} style={{ width: '33.3%', flexDirection: 'row', alignItems: 'center', padding: 2 }}>
                  <Text style={[Type.tiny, { width: 18, textAlign: 'right' }]}>{i + 1}</Text>
                  <SecretInput
                    accessibilityLabel={`Word ${i + 1}`}
                    value={words[i]}
                    onChangeText={(t) => setWords(words.map((w, j) => (j === i ? t : w)))}
                    style={{ flex: 1, padding: 6, borderWidth: 0, borderBottomWidth: 1, borderRadius: 0, fontSize: 15, marginLeft: 4, color: i === unknown ? Colors.negative : Colors.ink }}
                  />
                </View>
              ))}
            </View>
            <Text style={Type.small}>
              {unknown >= 0 ? `Word ${unknown + 1} isn't in the word list. Check your paper.` : typed.every(Boolean) && !phraseOk ? "All words are valid, but they don't form a phrase. One may be in the wrong place." : 'Type each word from your paper. Paste is turned off on purpose.'}
            </Text>
            <Text style={s.label}>PASSPHRASE (ONLY IF YOU SET ONE)</Text>
            <SecretInput secureTextEntry placeholder="Leave empty if you didn't" value={pass} onChangeText={setPass} />
          </>
        ) : (
          <>
            <Text style={s.label}>SECRET KEY</Text>
            <SecretInput value={secret} onChangeText={(t) => setSecret(t.toUpperCase())} maxLength={56} placeholder="S…" style={{ fontFamily: 'monospace' }} />
            <Text style={Type.small}>
              Type it from your paper; paste is turned off. {secret.length}/56 characters{secret.length === 56 && !keyOk ? ', but it isn’t a valid key. Check for a typo.' : '.'}
            </Text>
          </>
        )}
        <View style={{ flex: 1 }} />
        <Button title="Import" disabled={mode === 'phrase' ? !phraseOk : !keyOk} onPress={submit} />
      </OfflineOnly>
    </Screen>
  );
}
