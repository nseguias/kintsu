import { stellarSeed } from '@crypto/mnemonic';
import { Keypair } from '@stellar/stellar-sdk';
import type { Router } from 'expo-router';

import { getWallet, isProtected, recordBackups, saveWallet } from '@/lib/stellar';

export type Backup = 'phrase' | 'key' | 'tags';

/** A wallet being created or imported. Lives only in memory between screens: never in router params or storage. */
export type Draft = {
  mnemonic?: string; // absent for an imported secret key
  rawSeed?: Uint8Array; // set for an imported secret key
  passphrase: string;
  imported: boolean;
  onlyBackups?: boolean; // adding backups to the wallet already on this phone: don't touch what the phone holds
  queue: Backup[];
  done: Backup[];
};

let draft: Draft | null = null;

export function startDraft(d: { mnemonic?: string; rawSeed?: Uint8Array; passphrase?: string; imported: boolean; onlyBackups?: boolean }) {
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
  if (!d.onlyBackups) await saveWallet(seedOf(d));
  await recordBackups(d.done);
  draft = null;
  // unmount every screen that showed a secret (and lift their screenshot block) before Home
  if (router.canDismiss()) router.dismissAll();
  router.replace('/home');
}

/**
 * Add a backup of the wallet already on this phone. A protected phone no longer holds the recovery
 * key, so it first brings it back from 2 tags (or typed from paper, offline) for this one backup.
 */
export async function backUp(router: Router) {
  const w = await getWallet();
  if (!w) return;
  if (isProtected(w)) return router.push('/restore?purpose=backup');
  startDraft({ rawSeed: w.signer.rawSecretKey(), imported: false, onlyBackups: true });
  router.push('/backup');
}

/** For an unlocked recovery key: refuse another wallet's key, then go to the backup choice. */
export async function backUpUnlocked(router: Router, d: Parameters<typeof startDraft>[0]) {
  startDraft({ ...d, onlyBackups: true });
  if (Keypair.fromRawEd25519Seed(Buffer.from(seedOf(getDraft()))).publicKey() !== (await getWallet())?.account) {
    draft = null;
    throw new Error('That’s a different wallet’s backup.');
  }
  router.replace('/backup');
}
