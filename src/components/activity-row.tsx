import React from 'react';
import { Linking } from 'react-native';

import { Row } from '@/components/ui';
import { explorerUrl, type Activity, type Currency } from '@/lib/chain';

export const fmt = (n: number | string) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
/** An amount in the user's currency: "$1,234.50", "€12.00" or "10,000 XLM". */
export const money = (n: number, c: Currency) =>
  c === 'XLM' ? `${fmt(n)} XLM` : n.toLocaleString(undefined, { style: 'currency', currency: c, minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (g: string) => `${g.slice(0, 6)}…${g.slice(-6)}`;

/** One payment in or out; tapping opens it on stellar.expert. */
export function ActivityRow({ a }: { a: Activity }) {
  return (
    <Row
      oneLine
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
