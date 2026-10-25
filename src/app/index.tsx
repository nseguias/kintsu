import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Colors } from '@/constants/theme';
import { getKeypair } from '@/lib/stellar';

/** First launch → welcome; a wallet on this phone → Home. */
export default function Gate() {
  const [hasWallet, setHasWallet] = useState<boolean>();
  useEffect(() => void getKeypair().then((kp) => setHasWallet(!!kp)), []);
  if (hasWallet === undefined) return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  return <Redirect href={hasWallet ? '/home' : '/welcome'} />;
}
