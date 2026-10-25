import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { TagUnlock } from '@/components/tag-unlock';
import { Button, Screen } from '@/components/ui';
import { backUpUnlocked, getDraft, nextBackup, startDraft } from '@/lib/draft';

export default function Restore() {
  const router = useRouter();
  if (useLocalSearchParams().purpose === 'backup') {
    return (
      <Screen>
        <TagUnlock
          intro="This phone is protected, so it no longer holds your recovery key. Unlock it from 2 of your tags for this one backup; it’s forgotten again right after."
          onSeed={(seed) => backUpUnlocked(router, { rawSeed: seed, imported: false })}
        />
        <Button kind="link" title="I only have paper" onPress={() => router.replace('/import?purpose=backup')} />
      </Screen>
    );
  }
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
