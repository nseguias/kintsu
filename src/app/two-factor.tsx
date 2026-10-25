import { Keypair } from '@stellar/stellar-sdk';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { TagUnlock } from '@/components/tag-unlock';
import { Button, Screen, SecretInput } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { configure, cosignersOf, server } from '@/lib/chain';
import { cancelTap } from '@/lib/nfc';
import { getWallet, isRekeyed } from '@/lib/stellar';
import { setupYubiKey, YubiKeyError } from '@/lib/yubikey';

const Step = ({ n, title }: { n: 1 | 2; title: string }) => (
  <View style={{ gap: 2 }}>
    <Text style={[Type.tiny, { color: Colors.inkSoft }]}>STEP {n} OF 2</Text>
    <Text style={Type.title}>{title}</Text>
  </View>
);

export default function TwoFactor() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [yubikey, setYubikey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const tapYubiKey = async () => {
    setError('');
    setBusy(true);
    try {
      setYubikey(await setupYubiKey(pin, adminPin || undefined));
      setPin('');
      setAdminPin('');
    } catch (e) {
      if (e instanceof YubiKeyError && e.code === 'needsAdmin') setNeedsAdmin(true);
      setError((e as Error).message || 'Lost the YubiKey. Hold it still and try again.');
    }
    setBusy(false);
  };

  // the recovery key exists only inside this callback: it signs one transaction and is dropped
  const turnOn = async (seed: Uint8Array) => {
    const recovery = Keypair.fromRawEd25519Seed(Buffer.from(seed));
    const w = (await getWallet())!;
    if (recovery.publicKey() !== w.account) throw new Error('These tags belong to a different wallet.');
    if (!isRekeyed(w)) throw new Error('This phone needs its own key first. Open Home while online, then try again.');
    const entry = await server.getAccountEntry(w.account);
    await configure(recovery, w.signer.publicKey(), [...cosignersOf(entry).filter((c) => c !== yubikey), yubikey]);
    setDone(true);
  };

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: Spacing.md }}>
          <Text style={[Type.title, { textAlign: 'center' }]}>2FA is on ✓</Text>
          <Text style={[Type.body, { textAlign: 'center' }]}>
            From now on, every payment needs this phone and a tap of your YubiKey. If you lose the YubiKey, your tags can turn 2FA off.
          </Text>
        </View>
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (busy) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[Type.heading, { textAlign: 'center' }]}>Hold your YubiKey flat against the back of your phone</Text>
        </View>
        <Button kind="secondary" title="Cancel" onPress={cancelTap} />
      </Screen>
    );
  }

  if (yubikey) {
    return (
      <Screen>
        <Step n={2} title="Confirm with your tags" />
        <Text style={[Type.small, { color: Colors.positive }]}>YubiKey ready ✓</Text>
        <TagUnlock
          intro="Only your tags can change who signs for this wallet. Type the PIN you chose for your tags, then hold 2 of your tags to the phone, one after the other."
          onSeed={turnOn}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Step n={1} title="Your YubiKey" />
      <Text style={[Type.body, { color: Colors.inkSoft }]}>
        Every payment will need this phone and a tap of your YubiKey. Your other YubiKey logins (Gmail, X…) aren’t touched.
      </Text>
      <SecretInput secureTextEntry keyboardType="number-pad" placeholder="YubiKey PIN" value={pin} onChangeText={setPin} />
      {needsAdmin && (
        <SecretInput secureTextEntry keyboardType="number-pad" placeholder="YubiKey admin PIN" value={adminPin} onChangeText={setAdminPin} />
      )}
      {!!error && <Text style={[Type.small, { color: needsAdmin && !adminPin ? Colors.inkSoft : Colors.negative }]}>{error}</Text>}
      <View style={{ flex: 1 }} />
      <Button title="Tap your YubiKey" disabled={pin.length < 6 || (needsAdmin && adminPin.length < 8)} onPress={tapYubiKey} />
    </Screen>
  );
}
