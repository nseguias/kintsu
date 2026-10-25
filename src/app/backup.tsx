import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Choice, Intro, Screen } from '@/components/ui';
import { getDraft, nextBackup } from '@/lib/draft';

export default function BackupChoice() {
  const router = useRouter();
  const d = getDraft();
  const canPhrase = !!d.mnemonic && !d.imported; // an imported phrase is already on paper; an S… key has none
  const [phrase, setPhrase] = useState(canPhrase);
  const [key, setKey] = useState(false);
  const [tags, setTags] = useState(false);
  const n = Number(phrase) + Number(key) + Number(tags);

  const go = () => {
    d.queue = [...(phrase ? ['phrase' as const] : []), ...(key ? ['key' as const] : []), ...(tags ? ['tags' as const] : [])];
    nextBackup(router);
  };

  return (
    <Screen>
      <Intro>Pick one or more. Each one alone is enough to get your wallet back, so two is safer than one.</Intro>
      <Choice title="NFC tags" body="Split across 3 tags + a PIN. Any 2 restore it." selected={tags} onPress={() => setTags(!tags)} />
      <Choice
        title="Recovery phrase on paper"
        body={canPhrase ? `${d.mnemonic!.split(' ').length} words, written by hand. Works in other Stellar wallets.` : d.imported && d.mnemonic ? 'You already have it on paper.' : 'Only shown once, when a wallet is created.'}
        selected={phrase}
        disabled={!canPhrase}
        onPress={() => setPhrase(!phrase)}
      />
      <Choice
        title="Secret key on paper"
        body={d.imported && !d.mnemonic ? 'You already have it on paper.' : 'The 56-character S… key, written by hand.'}
        selected={key}
        disabled={d.imported && !d.mnemonic}
        onPress={() => setKey(!key)}
      />
      <View style={{ flex: 1 }} />
      <Button title={n ? `Back up with ${n} method${n > 1 ? 's' : ''}` : 'Pick at least one'} disabled={!n} onPress={go} />
      <Button kind="link" title={d.imported ? 'Skip, my paper is enough' : 'Skip for now (not safe)'} onPress={() => nextBackup(router)} />
    </Screen>
  );
}
