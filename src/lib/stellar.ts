import { Keypair, Networks, rpc } from '@stellar/stellar-sdk';
import * as SecureStore from 'expo-secure-store';

// ponytail: testnet only; mainnet needs real funding instead of Friendbot.
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const server = new rpc.Server(RPC_URL);

const SECRET_KEY = 'stellar.secret';
let keypair: Promise<Keypair> | undefined;

/** This device's key. Created once; memoised so concurrent first calls can't mint two keys. */
export function getKeypair(): Promise<Keypair> {
  keypair ??= (async () => {
    let secret = await SecureStore.getItemAsync(SECRET_KEY);
    if (!secret) {
      secret = Keypair.random().secret();
      await SecureStore.setItemAsync(SECRET_KEY, secret);
    }
    return Keypair.fromSecret(secret);
  })();
  keypair.catch(() => (keypair = undefined)); // let a later call retry
  return keypair;
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
    const address = (await getKeypair()).publicKey();
    if (!(await accountExists(address))) await server.fundAddress(address);
  })();
  funded.catch(() => (funded = undefined));
  return funded;
}

/** Native balance in XLM, read over RPC. */
export async function getXlmBalance(): Promise<number> {
  await ensureFunded();
  const entry = await server.getAccountEntry((await getKeypair()).publicKey());
  return Number(entry.balance) / 1e7; // stroops → XLM; fine for display
}
