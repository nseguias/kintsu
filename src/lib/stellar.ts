import { Keypair, Networks, rpc } from '@stellar/stellar-sdk';
import * as SecureStore from 'expo-secure-store';

// ponytail: testnet only; mainnet needs real funding instead of Friendbot.
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const server = new rpc.Server(RPC_URL);

const SECRET_KEY = 'stellar.secret';
const BACKUPS_KEY = 'wallet.backups';
let keypair: Promise<Keypair | null> | undefined;

/** This phone's wallet, or null on first launch. Memoised. */
export function getKeypair(): Promise<Keypair | null> {
  keypair ??= SecureStore.getItemAsync(SECRET_KEY).then((s) => (s ? Keypair.fromSecret(s) : null));
  keypair.catch(() => (keypair = undefined)); // let a later call retry
  return keypair;
}

async function requireKeypair(): Promise<Keypair> {
  const kp = await getKeypair();
  if (!kp) throw new Error('No wallet on this phone');
  return kp;
}

export async function saveWallet(seed: Uint8Array): Promise<void> {
  const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
  await SecureStore.setItemAsync(SECRET_KEY, kp.secret());
  keypair = Promise.resolve(kp);
  funded = undefined;
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

async function accountExists(address: string): Promise<boolean> {
  try {
    await server.getAccountEntry(address);
    return true;
  } catch (e) {
    if (String(e).includes('not found')) return false;
    throw e; // network trouble: don't call Friendbot on a guess
  }
}

let funded: Promise<void> | undefined;

/** Friendbot-funds the account the first time it is seen on testnet. */
export function ensureFunded(): Promise<void> {
  funded ??= (async () => {
    const address = (await requireKeypair()).publicKey();
    if (!(await accountExists(address))) await server.fundAddress(address);
  })();
  funded.catch(() => (funded = undefined));
  return funded;
}

/** Native balance in XLM, read over RPC. */
export async function getXlmBalance(): Promise<number> {
  await ensureFunded();
  const entry = await server.getAccountEntry((await requireKeypair()).publicKey());
  return Number(entry.balance) / 1e7; // stroops → XLM; fine for display
}
