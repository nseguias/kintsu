import { Keypair } from '@stellar/stellar-sdk';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { TagUnlock } from '@/components/tag-unlock';
import { Button, Screen, SecretInput, s } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { configure, cosignersOf, server } from '@/lib/chain';
import { cancelTap } from '@/lib/nfc';
import { getWallet, isRekeyed } from '@/lib/stellar';
import { setupYubiKey } from '@/lib/yubikey';

export default function TwoFactor() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [yubikey, setYubikey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const tapYubiKey = async () => {
    setError('');
    setBusy(true);
    try {
      setYubikey(await setupYubiKey(adminPin, pin));
      setPin('');
      setAdminPin('');
    } catch (e) {
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
            Every payment now needs this phone and a tap of your YubiKey. Lost the YubiKey? Your tags can turn 2FA off.
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
        <View style={[s.card, { gap: 4 }]}>
          <Text style={Type.heading}>YubiKey ready ✓</Text>
          <Text style={[Type.small, { fontFamily: 'monospace' }]}>{yubikey}</Text>
        </View>
        <TagUnlock intro="Last step: only your recovery key can change who signs. Tap 2 of your tags to confirm." onSeed={turnOn} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={[Type.body, { color: Colors.inkSoft }]}>
        After this, sending needs this phone plus a tap of your YubiKey. A thief with just your phone can’t send.
      </Text>
      <Text style={Type.small}>
        Shards uses the YubiKey’s OpenPGP app only. Your other uses (Gmail, X and other security-key logins) are separate and stay untouched.
      </Text>
      <SecretInput secureTextEntry keyboardType="number-pad" placeholder="YubiKey PIN (factory default 123456)" value={pin} onChangeText={setPin} />
      <SecretInput secureTextEntry keyboardType="number-pad" placeholder="Admin PIN (factory default 12345678)" value={adminPin} onChangeText={setAdminPin} />
      <Text style={Type.small}>The admin PIN is only needed the first time, to create the key.</Text>
      {!!error && <Text style={[Type.small, { color: Colors.negative }]}>{error}</Text>}
      <View style={{ flex: 1 }} />
      <Button title="Tap your YubiKey" disabled={pin.length < 6} onPress={tapYubiKey} />
    </Screen>
  );
}
