import { useRouter } from 'expo-router';
import React from 'react';

import { TagUnlock } from '@/components/tag-unlock';
import { Screen } from '@/components/ui';
import { getDraft, nextBackup, startDraft } from '@/lib/draft';

export default function Restore() {
  const router = useRouter();
  return (
    <Screen>
      <TagUnlock
        intro="Any 2 of your 3 tags plus the PIN you chose bring your wallet back."
        onSeed={async (seed) => {
          startDraft({ rawSeed: seed, imported: false });
          getDraft().done.push('tags');
          await nextBackup(router);
        }}
      />
    </Screen>
  );
}
