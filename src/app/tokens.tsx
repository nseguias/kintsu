import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Busy, Button, ErrorText, Intro, List, Row, Screen, SecretInput } from '@/components/ui';
import { Type } from '@/constants/theme';
import { addTokenTx, knownTokens, server, spendable, type Token } from '@/lib/chain';
import { cancelTap } from '@/lib/nfc';
import { fmt } from '@/components/activity-row';
import { approve, getHoldings, getWallet, needsYubiKey, type Holding } from '@/lib/stellar';

export default function Tokens() {
  const router = useRouter();
  const [held, setHeld] = useState<Holding[]>();
  const added = held?.flatMap((h) => (h.token ? [h.token.issuer] : []));
  const [picked, setPicked] = useState<Token>();
  const [yubikey, setYubikey] = useState(false);
  const [canAfford, setCanAfford] = useState(true);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const w = (await getWallet())!;
      setHeld(await getHoldings());
      setYubikey(await needsYubiKey());
      setCanAfford(spendable(await server.getAccountEntry(w.account)) >= 0.5);
    })().catch((e) => setError(String(e)));
  }, []);

  const add = async () => {
    setError('');
    setBusy('Adding…');
    try {
      const w = (await getWallet())!;
      await approve(await addTokenTx(w.account, picked!), pin, () => setBusy('Hold your YubiKey flat against the back of your phone'));
      router.back();
    } catch (e) {
      setError((e as Error).message || 'Lost the YubiKey. Hold it still and try again.');
    }
    setPin('');
    setBusy('');
  };

  if (busy) return <Screen><Busy message={busy} onCancel={busy.startsWith('Hold') ? cancelTap : undefined} /></Screen>;

  if (picked) {
    return (
      <Screen>
        <Text style={Type.title}>Add {picked.code}</Text>
        <Intro>
          Your wallet will be able to hold {picked.name}, issued by Circle. Stellar sets aside 0.5 XLM while you keep it; you get it back if you remove the token.
        </Intro>
        {yubikey && <SecretInput secureTextEntry placeholder="YubiKey PIN" value={pin} onChangeText={setPin} />}
        <ErrorText>{error}</ErrorText>
        <View style={{ flex: 1 }} />
        <Button title={yubikey ? 'Tap your YubiKey to add' : `Add ${picked.code}`} disabled={!canAfford || (yubikey && pin.length < 6)} onPress={add} />
        <Button kind="link" title="Back" onPress={() => setPicked(undefined)} />
      </Screen>
    );
  }

  return (
    <Screen>
      {held && (
        <List label="IN YOUR WALLET">
          {held.map((h) => (
            <Row key={h.token ? `${h.token.code}:${h.token.issuer}` : 'XLM'} badge={h.token ? h.token.code[0] : 'X'} title={h.token?.code ?? 'XLM'} detail={h.token?.name ?? 'Stellar Lumens'} right={fmt(h.amount)} />
          ))}
        </List>
      )}
      <Intro>On Stellar anyone can make a token with any name, so Shards only lists ones from issuers it has checked.</Intro>
      {added && (
        <List label="ADD A TOKEN">
          {knownTokens().map((t) => (
            <Row
              key={t.code}
              badge={t.code[0]}
              title={t.code}
              detail={t.name}
              right={added.includes(t.issuer) ? 'Added' : undefined}
              onPress={added.includes(t.issuer) ? undefined : () => setPicked(t)}
            />
          ))}
        </List>
      )}
      {!canAfford && <Text style={Type.small}>Adding a token needs 0.5 XLM free in the wallet.</Text>}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
