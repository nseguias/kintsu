import { Keypair } from '@stellar/stellar-sdk';
import * as SecureStore from 'expo-secure-store';

import { accountExists, configure, cosignersOf, isConfigured, server, signersOf } from '@/lib/chain';

const SIGNER_KEY = 'stellar.secret'; // what this phone signs with: the recovery key until protected, then its device key
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

/** Protected: this phone holds only its own device key; the recovery key lives on the backups. */
export const isProtected = (w: Wallet) => w.signer.publicKey() !== w.account;

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

/** Stores the recovery key (created, imported or restored). The phone can do everything until protected. */
export async function saveWallet(seed: Uint8Array): Promise<void> {
  const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
  await SecureStore.setItemAsync(ACCOUNT_KEY, kp.publicKey());
  await SecureStore.setItemAsync(SIGNER_KEY, kp.secret());
  await SecureStore.deleteItemAsync(PENDING_KEY);
  wallet = Promise.resolve({ account: kp.publicKey(), signer: kp });
  funded = undefined;
}

let protecting: Promise<void> | undefined;

/**
 * Gives this phone its own device key, sets the second factors (rules in chain.ts) and deletes the
 * recovery key from the phone. Needs a backup: afterwards the recovery key lives nowhere else.
 * Safe to retry after a crash: the new key is saved before the ledger can trust it.
 */
export function protectWallet(cosigners: string[]): Promise<void> {
  protecting ??= (async () => {
    const w = await requireWallet();
    if (isProtected(w)) throw new Error('Already protected; changes need your backup.');
    if (!(await getBackups()).length) throw new Error('Back up first: after this, your backup is the only way to change who controls the wallet.');
    const pending = await SecureStore.getItemAsync(PENDING_KEY);
    const device = pending ? Keypair.fromSecret(pending) : Keypair.random();
    if (!pending) await SecureStore.setItemAsync(PENDING_KEY, device.secret());
    if (!isConfigured(await server.getAccountEntry(w.account), device.publicKey(), cosigners)) await configure(w.signer, device.publicKey(), cosigners);
    await SecureStore.setItemAsync(SIGNER_KEY, device.secret()); // the recovery key leaves this phone here
    await SecureStore.deleteItemAsync(PENDING_KEY);
    wallet = Promise.resolve({ account: w.account, signer: device });
  })();
  const clear = () => (protecting = undefined);
  protecting.then(clear, clear);
  return protecting;
}

/**
 * After a restore onto this phone: if the wallet was protected, protect it again right away. That
 * locks out the old phone (still a signer) and keeps the second factors. Unprotected wallets stay as they are.
 */
export async function keepProtection(): Promise<void> {
  const w = await requireWallet();
  if (isProtected(w) || !(await accountExists(w.account))) return;
  const entry = await server.getAccountEntry(w.account);
  if (signersOf(entry).length) await protectWallet(cosignersOf(entry));
}

export type BackupRecord = { kind: 'phrase' | 'key' | 'tags'; at: string };
export const BACKUP_LABEL: Record<BackupRecord['kind'], string> = { phrase: 'Recovery phrase', key: 'Secret key', tags: 'NFC tags' };

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
