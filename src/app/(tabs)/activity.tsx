import React, { useCallback, useEffect, useState } from 'react';

import { ActivityRow } from '@/components/activity-row';
import { ErrorText, Intro, List, Screen } from '@/components/ui';
import { recentActivity, type Activity } from '@/lib/chain';
import { getWallet } from '@/lib/stellar';

export default function ActivityScreen() {
  const [rows, setRows] = useState<Activity[]>();
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setRows(await recentActivity((await getWallet())!.account, 50));
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => void load(), [load]);

  return (
    <Screen onRefresh={load}>
      <ErrorText>{error}</ErrorText>
      {rows && !rows.length && <Intro>No payments yet.</Intro>}
      {!!rows?.length && (
        <List>
          {rows.map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
        </List>
      )}
    </Screen>
  );
}
