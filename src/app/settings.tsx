import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { List, Row, Screen } from '@/components/ui';
import { backUp } from '@/lib/draft';
import { BACKUP_LABEL, forgetWallet, getBackups, getWallet, isProtected, type BackupRecord } from '@/lib/stellar';

export default function Settings() {
  const router = useRouter();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [protectedNow, setProtectedNow] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getBackups().then(setBackups);
      getWallet().then((w) => setProtectedNow(!!w && isProtected(w)));
    }, []),
  );

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
        {protectedNow ? (
          <Row icon="information-circle-outline" title="Add another backup" detail="Not available on a protected phone yet: it no longer holds the recovery key." />
        ) : (
          <Row icon="add-circle-outline" title={backups.length ? 'Add another backup' : 'Back up now'} onPress={() => backUp(router)} />
        )}
      </List>

      <List label="WALLET">
        <Row icon="qr-code-outline" title="Address" detail="Show your QR code" onPress={() => router.push('/receive')} />
        <Row icon="globe-outline" title="Network" right="Testnet" />
      </List>

      <List label="THIS PHONE">
        <Row icon="trash-outline" tone="negative" title="Remove wallet" detail="Then create, import or restore another" onPress={remove} />
      </List>
    </Screen>
  );
}
