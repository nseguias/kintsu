import { Keypair } from '@stellar/stellar-sdk';
import * as SecureStore from 'expo-secure-store';

import { accountExists, isRekeyedTo, rekey, server } from '@/lib/chain';

const SIGNER_KEY = 'stellar.secret'; // what this phone signs with: the recovery key until re-keyed, then its device key
const ACCOUNT_KEY = 'wallet.account'; // the G… address, which is always the recovery key's
const PENDING_KEY = 'wallet.pendingDevice';
const BACKUPS_KEY = 'wallet.backups';

export type Wallet = { account: string; signer: Keypair };
let wallet: Promise<Wallet | null> | undefined;

/** This phone's wallet, or null on first launch. Memoised. */
export function getWallet(): Promise<Wallet | null> {
  wallet ??= (async () => {
    const secret = await SecureStore.getItemAsync(SIGNER_KEY);
    if (!secret) return null;
    const signer = Keypair.fromSecret(secret);
    return { account: (await SecureStore.getItemAsync(ACCOUNT_KEY)) ?? signer.publicKey(), signer };
  })();
  wallet.catch(() => (wallet = undefined)); // let a later call retry
  return wallet;
}

/** Re-keyed: this phone holds only its own device key; the recovery key lives on the backups. */
export const isRekeyed = (w: Wallet) => w.signer.publicKey() !== w.account;

async function requireWallet(): Promise<Wallet> {
  const w = await getWallet();
  if (!w) throw new Error('No wallet on this phone');
  return w;
}

/** Removes the wallet from this phone. Only its backups can bring it back. */
export async function forgetWallet(): Promise<void> {
  for (const k of [SIGNER_KEY, ACCOUNT_KEY, PENDING_KEY, BACKUPS_KEY]) await SecureStore.deleteItemAsync(k);
  wallet = undefined;
  funded = undefined;
}

/** Stores the recovery key (created, imported or restored). Re-keying happens later, once online. */
export async function saveWallet(seed: Uint8Array): Promise<void> {
  const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
  await SecureStore.setItemAsync(ACCOUNT_KEY, kp.publicKey());
  await SecureStore.setItemAsync(SIGNER_KEY, kp.secret());
  await SecureStore.deleteItemAsync(PENDING_KEY);
  wallet = Promise.resolve({ account: kp.publicKey(), signer: kp });
  funded = undefined;
}

let rekeying: Promise<void> | undefined;

/**
 * Gives this phone its own device key and deletes the recovery key from it (rules in chain.ts).
 * Only once a backup exists: afterwards the recovery key lives nowhere else. Also run after a
 * restore, where it fires the old phone's key. Safe to call repeatedly and to crash mid-way.
 */
export function ensureRekeyed(): Promise<void> {
  rekeying ??= (async () => {
    const w = await requireWallet();
    if (isRekeyed(w) || !(await getBackups()).length) return;
    await ensureFunded();
    // saved before submitting, so a crash after the ledger accepts it can't lose a key the account trusts
    const pending = await SecureStore.getItemAsync(PENDING_KEY);
    const device = pending ? Keypair.fromSecret(pending) : Keypair.random();
    if (!pending) await SecureStore.setItemAsync(PENDING_KEY, device.secret());
    if (!isRekeyedTo(await server.getAccountEntry(w.account), device.publicKey())) await rekey(w.signer, device.publicKey());
    await SecureStore.setItemAsync(ACCOUNT_KEY, w.account);
    await SecureStore.setItemAsync(SIGNER_KEY, device.secret()); // the recovery key leaves this phone here
    await SecureStore.deleteItemAsync(PENDING_KEY);
    wallet = Promise.resolve({ account: w.account, signer: device });
  })();
  const clear = () => (rekeying = undefined);
  rekeying.then(clear, clear);
  return rekeying;
}

export type BackupRecord = { kind: 'phrase' | 'key' | 'tags'; at: string };

export async function recordBackups(kinds: BackupRecord['kind'][]): Promise<void> {
  const at = new Date().toISOString();
  const all = [...(await getBackups()).filter((b) => !kinds.includes(b.kind)), ...kinds.map((kind) => ({ kind, at }))];
  await SecureStore.setItemAsync(BACKUPS_KEY, JSON.stringify(all));
}

export async function getBackups(): Promise<BackupRecord[]> {
  return JSON.parse((await SecureStore.getItemAsync(BACKUPS_KEY)) ?? '[]');
}

let funded: Promise<void> | undefined;

/** Friendbot-funds the account the first time it is seen on testnet. */
export function ensureFunded(): Promise<void> {
  funded ??= (async () => {
    const address = (await requireWallet()).account;
    if (!(await accountExists(address))) await server.fundAddress(address);
  })();
  funded.catch(() => (funded = undefined));
  return funded;
}

/** Native balance in XLM, read over RPC. */
export async function getXlmBalance(): Promise<number> {
  await ensureFunded();
  const entry = await server.getAccountEntry((await requireWallet()).account);
  return Number(entry.balance) / 1e7; // stroops → XLM; fine for display
}
