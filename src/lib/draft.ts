import { stellarSeed } from '@crypto/mnemonic';
import type { Router } from 'expo-router';

import { recordBackups, saveWallet } from '@/lib/stellar';

export type Backup = 'phrase' | 'key' | 'tags';

/** A wallet being created or imported. Lives only in memory between screens: never in router params or storage. */
export type Draft = {
  mnemonic?: string; // absent for an imported S… key
  rawSeed?: Uint8Array; // set for an imported S… key
  passphrase: string;
  imported: boolean;
  queue: Backup[];
  done: Backup[];
};

let draft: Draft | null = null;

export function startDraft(d: { mnemonic?: string; rawSeed?: Uint8Array; passphrase?: string; imported: boolean }) {
  // whatever was imported was typed from paper, so that paper already is a backup
  const done: Backup[] = d.imported ? [d.mnemonic ? 'phrase' : 'key'] : [];
  draft = { passphrase: '', queue: [], done, ...d };
}

export function getDraft(): Draft {
  if (!draft) throw new Error('No wallet in progress');
  return draft;
}

export const seedOf = (d: Draft) => d.rawSeed ?? stellarSeed(d.mnemonic!, d.passphrase);

const ROUTES = { phrase: '/backup-phrase', key: '/backup-key', tags: '/backup-tags' } as const;

/** Runs the chosen backups in order (phrase first: the passphrase changes the key), then saves the wallet. */
export async function nextBackup(router: Router, finished?: Backup) {
  const d = getDraft();
  if (finished) d.done.push(finished);
  const next = d.queue.shift();
  if (next) return router.push(ROUTES[next]);
  await saveWallet(seedOf(d));
  await recordBackups(d.done);
  draft = null;
  // unmount every screen that showed a secret (and lift their screenshot block) before Home
  if (router.canDismiss()) router.dismissAll();
  router.replace('/home');
}
