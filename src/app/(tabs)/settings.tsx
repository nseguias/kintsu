import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { Text } from '@/components/text';
import { ErrorText, List, Row, Screen, Segmented, s } from '@/components/ui';
import { Type } from '@/constants/theme';
import { network, type Currency, type Network } from '@/lib/chain';
import { backUp } from '@/lib/draft';
import { BACKUP_LABEL, forgetWallet, getBackups, getCurrency, getWallet, isProtected, setCurrency, setNetwork, type BackupRecord } from '@/lib/stellar';

export default function Settings() {
  const router = useRouter();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [protectedNow, setProtectedNow] = useState(false);
  const [net, setNet] = useState<Network>(network);
  const [error, setError] = useState('');
  const [currency, setCur] = useState<Currency>('USD');

  useFocusEffect(
    useCallback(() => {
      getBackups().then(setBackups);
      getCurrency().then(setCur);
      getWallet().then((w) => {
        setProtectedNow(!!w && isProtected(w));
        setNet(network);
      });
    }, []),
  );

  const switchTo = (n: Network) => {
    const go = () => setNetwork(n).then(() => setNet(n), (e) => setError(e.message));
    if (n === 'testnet') return go();
    Alert.alert('Use mainnet?', 'Mainnet XLM is real money. Kintsu is in beta: start with small amounts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use mainnet', onPress: go },
    ]);
  };

  const remove = () =>
    Alert.alert(
      'Remove wallet from this phone?',
      backups.length
        ? 'Your XLM stays on Stellar. To use this wallet again, restore it from your backup.'
        : 'This wallet has no backup. Removing it loses its XLM for good.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await forgetWallet();
            router.dismissAll();
            router.replace('/welcome');
          },
        },
      ],
    );

  return (
    <Screen>
      <List label="SECURITY">
        <Row icon="shield-outline" title="Protection" detail={protectedNow ? 'Phone protected' : 'This phone can do everything'} onPress={() => router.push('/protect')} />
      </List>

      <List label="BACKUPS">
        {backups.map((b) => (
          <Row key={b.kind} icon="checkmark-circle" tone="positive" title={BACKUP_LABEL[b.kind]} right={new Date(b.at).toLocaleDateString()} />
        ))}
        <Row
          icon="add-circle-outline"
          title={backups.length ? 'Add a backup' : 'Back up now'}
          detail={protectedNow ? 'Unlock with 2 of your tags first' : 'NFC tags or secret key on paper'}
          onPress={() => backUp(router)}
        />
      </List>

      <List label="WALLET">
        <Row icon="qr-code-outline" title="Address" detail="Show your QR code" onPress={() => router.push('/receive')} />
      </List>

      <Text style={s.label}>NETWORK</Text>
      <Segmented options={[{ label: 'Testnet', value: 'testnet' }, { label: 'Mainnet', value: 'mainnet' }]} value={net} onChange={switchTo} />
      <Text style={Type.small}>
        {protectedNow
          ? `Same address on both, but this phone is protected on ${net}, so it stays there.`
          : 'Same address on both networks, with a separate balance on each. Testnet XLM is free and worthless, for trying things out.'}
      </Text>
      <ErrorText>{error}</ErrorText>

      <Text style={s.label}>SHOW TOTALS IN</Text>
      <Segmented options={[{ label: 'USD', value: 'USD' }, { label: 'EUR', value: 'EUR' }, { label: 'XLM', value: 'XLM' }]} value={currency} onChange={(c) => setCurrency(c).then(() => setCur(c))} />
      <Text style={Type.small}>Prices come from Stellar’s own exchange on mainnet, also while you’re on testnet.</Text>

      <List label="THIS PHONE">
        <Row icon="trash-outline" tone="negative" title="Remove wallet" detail="Then create a new one or bring back another" onPress={remove} />
      </List>
    </Screen>
  );
}
