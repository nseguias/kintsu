import React from 'react';
import { Linking } from 'react-native';

import { Row } from '@/components/ui';
import { explorerUrl, type Activity } from '@/lib/chain';

export const fmt = (n: number | string) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
const short = (g: string) => `${g.slice(0, 4)}…${g.slice(-4)}`;

/** One payment in or out; tapping opens it on stellar.expert. */
export function ActivityRow({ a }: { a: Activity }) {
  return (
    <Row
      badge={a.incoming ? 'arrow-down' : 'arrow-up'}
      badgeTone={a.incoming ? 'positive' : 'negative'}
      title={a.incoming ? 'Received' : 'Sent'}
      detail={`${a.incoming ? 'From' : 'To'} ${short(a.other)} · ${new Date(a.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
      right={`${a.incoming ? '+' : '−'}${fmt(a.amount)} ${a.code}`}
      rightTone={a.incoming ? 'positive' : undefined}
      onPress={() => Linking.openURL(explorerUrl(a.tx))}
    />
  );
}
