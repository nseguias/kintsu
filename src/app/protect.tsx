import { Keypair, type xdr } from '@stellar/stellar-sdk';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { TagUnlock } from '@/components/tag-unlock';
import { Busy, Button, Choice, ErrorText, Intro, List, Row, Screen, SecretInput } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { configure, cosignersOf, needs2fa, protectionMinimum, server } from '@/lib/chain';
import { backUp } from '@/lib/draft';
import { cancelTap } from '@/lib/nfc';
import { getBackups, getWallet, isProtected, protectWallet, type Wallet } from '@/lib/stellar';
import { setupYubiKey, YubiKeyError } from '@/lib/yubikey';

type Loaded = { w: Wallet; entry: xdr.AccountEntry | null; backedUp: boolean };
// what the user is doing on this screen
type Mode = 'overview' | 'yubikey' | 'tags';

export default function Protect() {
  const router = useRouter();
  const [state, setState] = useState<Loaded>();
  const [mode, setMode] = useState<Mode>('overview');
  const [withYubiKey, setWithYubiKey] = useState(true);
  const [yubikey, setYubikey] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    (async () => {
      const w = (await getWallet())!;
      const entry = await server.getAccountEntry(w.account).catch(() => null);
      setState({ w, entry, backedUp: (await getBackups()).length > 0 });
    })().catch((e) => setError(String(e)));
  }, []);

  const run = async (message: string, fn: () => Promise<void>) => {
    setError('');
    setBusy(message);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || 'Something went wrong. Try again.');
    }
    setBusy('');
  };

  if (!state) return <Screen>{error ? <ErrorText>{error}</ErrorText> : <Busy message="Checking your wallet…" />}</Screen>;
  const { w, entry, backedUp } = state;
  const protectedNow = isProtected(w);
  const factors = entry ? cosignersOf(entry) : [];
  const twoFactor = !!entry && needs2fa(entry);
  const balance = entry ? Number(entry.balance) / 1e7 : 0;

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: Spacing.md }}>
          <Text style={[Type.title, { textAlign: 'center' }]}>Done ✓</Text>
          <Intro>{done}</Intro>
        </View>
        <Button title="Back to wallet" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (busy) return <Screen><Busy message={busy} onCancel={busy.startsWith('Hold') ? cancelTap : undefined} /></Screen>;

  // 1. this phone holds the recovery key: protect it, optionally with a YubiKey; no tags needed
  const protect = (yk: string) =>
    run('Protecting…', async () => {
      await protectWallet(yk ? [yk] : []);
      setDone(yk ? 'This phone can now only send, and every payment also needs your YubiKey.' : 'This phone can now only send. Changing who controls the wallet needs your backup.');
    });

  // 2. already protected: key changes need the recovery key, brought back from the tags for one signature
  const change = (cosigners: string[], message: string) => async (seed: Uint8Array) => {
    const recovery = Keypair.fromRawEd25519Seed(Buffer.from(seed));
    if (recovery.publicKey() !== w.account) throw new Error('These tags belong to a different wallet.');
    await configure(recovery, w.signer.publicKey(), cosigners);
    setDone(message);
  };

  if (mode === 'yubikey') {
    return (
      <Screen>
        <YubiKeyStep
          onReady={(yk) => {
            setYubikey(yk);
            if (protectedNow) setMode('tags');
            else protect(yk);
          }}
        />
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  if (mode === 'tags') {
    const adding = !!yubikey;
    return (
      <Screen>
        {adding && <Text style={[Type.small, { color: Colors.positive }]}>YubiKey ready ✓</Text>}
        <TagUnlock
          intro={`Only your backup can change who controls this wallet. Type the PIN you chose for your tags, then hold 2 of your tags to the phone, one after the other.`}
          onSeed={
            adding
              ? change([...factors.filter((f) => f !== yubikey), yubikey], 'Every payment now needs this phone and your YubiKey.')
              : change([], '2FA is off. This phone can send on its own again.')
          }
        />
      </Screen>
    );
  }

  const need = protectionMinimum(factors.length + (protectedNow ? 1 : Number(withYubiKey)));
  const short = balance < need;
  const fund = short && (
    <View style={{ gap: Spacing.sm }}>
      <Text style={Type.small}>
        Needs at least {need.toFixed(2)} XLM in the wallet: Stellar sets aside 0.5 XLM for each key. You have {balance.toFixed(2)} XLM.
      </Text>
      <Button kind="secondary" title="Receive XLM" onPress={() => router.push('/receive')} />
    </View>
  );

  if (!protectedNow) {
    return (
      <Screen>
        <List>
          <Row icon="alert-circle" tone="accent" title="This phone can do everything" detail="Anyone who unlocks it could send all your XLM and take the wallet for good." />
        </List>
        <Intro>
          Protecting gives this phone its own key that can only send, and removes your recovery key from it. Lose the phone? Restore from your backup and the old phone is locked out.
        </Intro>
        {!backedUp ? (
          <>
            <Text style={Type.small}>Back up first: after protecting, your backup is the only way to change who controls the wallet.</Text>
            <View style={{ flex: 1 }} />
            <Button title="Back up now" onPress={() => backUp(router)} />
          </>
        ) : (
          <>
            <Choice
              title="Also require my YubiKey"
              body="Every payment then needs this phone and a tap of your YubiKey."
              selected={withYubiKey}
              onPress={() => setWithYubiKey(!withYubiKey)}
            />
            {fund}
            <ErrorText>{error}</ErrorText>
            <View style={{ flex: 1 }} />
            <Button title="Protect this wallet" disabled={short} onPress={() => (withYubiKey ? setMode('yubikey') : protect(''))} />
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <List>
        <Row icon="shield-checkmark" tone="positive" title="This phone is protected" detail="It can send, but can’t change who controls the wallet." />
        <Row
          icon="key"
          tone={twoFactor ? 'positive' : undefined}
          title="YubiKey 2FA"
          detail={twoFactor ? 'Every payment needs this phone and your YubiKey.' : 'Off: this phone can send on its own.'}
          right={twoFactor ? 'On' : 'Off'}
        />
      </List>
      {!twoFactor && fund}
      <ErrorText>{error}</ErrorText>
      <View style={{ flex: 1 }} />
      {twoFactor ? (
        <Button kind="secondary" title="Turn off 2FA (lost YubiKey)" onPress={() => setMode('tags')} />
      ) : (
        <Button title="Add a YubiKey" disabled={short} onPress={() => setMode('yubikey')} />
      )}
    </Screen>
  );
}

/** PIN (and the admin PIN only for a YubiKey with no key yet), then one tap → its Stellar address. */
function YubiKeyStep({ onReady }: { onReady: (address: string) => void }) {
  const [pin, setPin] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tap = async () => {
    setError('');
    setBusy(true);
    try {
      onReady(await setupYubiKey(pin, adminPin || undefined));
    } catch (e) {
      if (e instanceof YubiKeyError && e.code === 'needsAdmin') setNeedsAdmin(true);
      setError((e as Error).message || 'Lost the YubiKey. Hold it still and try again.');
    }
    setBusy(false);
  };

  if (busy) return <Busy message="Hold your YubiKey flat against the back of your phone" onCancel={cancelTap} />;
  return (
    <>
      <Text style={Type.title}>Your YubiKey</Text>
      <Intro>Type its PIN, then hold it to the back of the phone. Your other YubiKey logins (Gmail, X…) aren’t touched.</Intro>
      <SecretInput secureTextEntry placeholder="YubiKey PIN" value={pin} onChangeText={setPin} />
      {needsAdmin && <SecretInput secureTextEntry placeholder="YubiKey admin PIN" value={adminPin} onChangeText={setAdminPin} />}
      <ErrorText>{error}</ErrorText>
      <View style={{ flex: 1 }} />
      <Button title="Tap your YubiKey" disabled={pin.length < 6 || (needsAdmin && adminPin.length < 8)} onPress={tap} />
    </>
  );
}
