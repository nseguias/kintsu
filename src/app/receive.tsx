import React, { useEffect, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { QrCode } from '@/components/qr';
import { Intro, Screen } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { getWallet } from '@/lib/stellar';

export default function Receive() {
  const [account, setAccount] = useState('');
  const { width } = useWindowDimensions();
  useEffect(() => void getWallet().then((w) => setAccount(w?.account ?? '')), []);

  return (
    <Screen>
      <Intro>Let the sender scan this, or share the address below. It’s public: safe to show.</Intro>
      {/* a bare address scans in every wallet and exchange; Send also reads SEP-7 links */}
      {!!account && (
        <View style={{ alignItems: 'center', marginVertical: Spacing.lg }}>
          <QrCode value={account} size={Math.min(width - 2 * Spacing.lg, 340)} />
        </View>
      )}
      <Text selectable style={[Type.mono, { textAlign: 'center' }]}>{account.match(/.{1,4}/g)?.join(' ')}</Text>
    </Screen>
  );
}
