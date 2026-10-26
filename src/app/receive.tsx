import React, { useEffect, useState } from 'react';
import { Share, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/text';
import { QrCode } from '@/components/qr';
import { Button, Screen, s } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { network } from '@/lib/chain';
import { getWallet } from '@/lib/stellar';

export default function Receive() {
  const [account, setAccount] = useState('');
  const { width } = useWindowDimensions();
  useEffect(() => void getWallet().then((w) => setAccount(w?.account ?? '')), []);
  const card = width - 40; // Screen's side padding
  const qr = Math.min(card - 2 * Spacing.xl, 340);

  return (
    <Screen>
      {/* a bare address scans in every wallet and exchange; Send also reads SEP-7 links */}
      <View style={[s.card, { alignItems: 'center', gap: Spacing.lg, padding: Spacing.xl, borderRadius: Radius.xl }]}>
        <Text style={[Type.tiny, { color: Colors.primary, backgroundColor: Colors.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, overflow: 'hidden' }]}>
          STELLAR {network.toUpperCase()}
        </Text>
        <View style={{ backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden' }}>
          {!!account && <QrCode value={account} size={qr} />}
        </View>
        <Text selectable style={[Type.mono, { textAlign: 'center', lineHeight: 24, maxWidth: qr }]}>
          {account.match(/.{1,4}/g)?.join(' ')}
        </Text>
      </View>
      <Text style={[Type.small, { textAlign: 'center' }]}>
        For XLM and tokens on Stellar {network} only. Your address is public: safe to share.
      </Text>
      <View style={{ flex: 1 }} />
      <Button title="Share address" disabled={!account} onPress={() => Share.share({ message: account })} />
    </Screen>
  );
}
