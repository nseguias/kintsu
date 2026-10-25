import { Asset, Keypair, Memo, Networks, Operation, rpc, StrKey, TransactionBuilder, type Transaction, type xdr } from '@stellar/stellar-sdk';

// No React Native imports here, so chain.test.ts can run it against testnet from Node.
export type Network = 'testnet' | 'mainnet';
// ponytail: SDF runs no public mainnet RPC; Gateway's is free and keyless. Swap for a paid provider if it rate-limits.
const NETWORKS = {
  testnet: { passphrase: Networks.TESTNET, rpc: 'https://soroban-testnet.stellar.org' },
  mainnet: { passphrase: Networks.PUBLIC, rpc: 'https://soroban-rpc.mainnet.stellar.gateway.fm' },
} as const;

// live bindings: importers always see the current network
export let network: Network = 'testnet';
export let NETWORK_PASSPHRASE: string = NETWORKS.testnet.passphrase;
export let server = new rpc.Server(NETWORKS.testnet.rpc);

export function selectNetwork(n: Network) {
  network = n;
  NETWORK_PASSPHRASE = NETWORKS[n].passphrase;
  server = new rpc.Server(NETWORKS[n].rpc);
}

// Weights double as roles: 5 = recovery key (account master), 2 = a phone, 1 = a second factor
// (YubiKey, later the helper service).
//   send (medium):        2 without 2FA → phone alone; 3 with 2FA → phone + one second factor.
//                         Second factors alone (1 + 1) never reach 3 without the phone.
//   change keys (high):   5 → only the recovery key; phone + every factor (2 + 1 + 1) is 4.
export const MASTER_WEIGHT = 5;
export const DEVICE_WEIGHT = 2;
export const COSIGNER_WEIGHT = 1;
const HIGH = 5;
const medium = (cosigners: string[]) => (cosigners.length ? 3 : 2);

export const newTx = async (account: string) =>
  new TransactionBuilder(await server.getAccount(account), { fee: '1000', networkPassphrase: NETWORK_PASSPHRASE }).setTimeout(60);

/** Sends a signed transaction and waits for the ledger to accept or reject it. */
export async function submit(tx: Transaction): Promise<void> {
  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error(`Rejected: ${sent.errorResult?.result.type ?? 'unknown'}`);
  const done = await server.pollTransaction(sent.hash);
  if (done.status !== 'SUCCESS') throw new Error(`Transaction ${done.status}`);
}

export async function accountExists(address: string): Promise<boolean> {
  try {
    await server.getAccountEntry(address);
    return true;
  } catch (e) {
    if (String(e).includes('not found')) return false;
    throw e; // network trouble: don't act on a guess
  }
}

/** XLM the account can send: balance minus the reserve Stellar locks (0.5 per entry, 2 base) and a fee. */
export function spendable(entry: xdr.AccountEntry): number {
  // ponytail: ignores sponsorship and offer liabilities; we create neither
  return Math.max(0, Number(entry.balance) / 1e7 - (2 + entry.numSubEntries) * 0.5 - 0.001);
}

/** An unsigned XLM payment. Creates the recipient's account if it doesn't exist yet (needs ≥ 1 XLM). */
export async function paymentTx(from: string, to: string, amount: string, memo = ''): Promise<Transaction> {
  const tx = (await newTx(from)).addOperation(
    (await accountExists(to))
      ? Operation.payment({ destination: to, asset: Asset.native(), amount })
      : Operation.createAccount({ destination: to, startingBalance: amount }),
  );
  if (memo) tx.addMemo(Memo.text(memo));
  return tx.build();
}

/** Extra ed25519 signers on the account (the master key isn't listed). */
export const signersOf = (entry: xdr.AccountEntry) =>
  entry.signers.flatMap((s) =>
    s.key.type === 'signerKeyTypeEd25519' ? [{ key: StrKey.encodeEd25519PublicKey(Buffer.from(s.key.ed25519.value)), weight: s.weight }] : [],
  );

/**
 * Second factors (YubiKey, helper) on the account. Accounts re-keyed by the first version (master
 * weight 2, phone weight 1) had none, and their weight-1 signer is a phone, not a factor.
 */
export const cosignersOf = (entry: xdr.AccountEntry) =>
  entry.thresholds.value[0] === MASTER_WEIGHT ? signersOf(entry).filter((s) => s.weight === COSIGNER_WEIGHT).map((s) => s.key) : [];

/** Whether sending needs a second factor right now. */
export const needs2fa = (entry: xdr.AccountEntry) => entry.thresholds.value[2] > DEVICE_WEIGHT;

/** True if the account already has exactly these weights, thresholds and signers. */
export function isConfigured(entry: xdr.AccountEntry, device: string, cosigners: string[]): boolean {
  const [master, low, med, high] = entry.thresholds.value;
  const want = new Map([[device, DEVICE_WEIGHT], ...cosigners.map((c) => [c, COSIGNER_WEIGHT] as const)]);
  const have = signersOf(entry);
  return (
    master === MASTER_WEIGHT && low === 1 && med === medium(cosigners) && high === HIGH &&
    have.length === want.size && have.every((s) => want.get(s.key) === s.weight)
  );
}

/**
 * One atomic transaction signed by the recovery key that leaves the account with exactly: this
 * `device` (phone), these `cosigners` (second factors), and the weights above. Everything else is
 * removed. Used to re-key a new phone, after a restore (old phones fired, factors kept), and to
 * turn 2FA on or off. ponytail: an imported account with someone else's signers loses them; fine
 * for wallets made here, ask first if we ever import shared accounts.
 */
export async function configure(recovery: Keypair, device: string, cosigners: string[]): Promise<void> {
  const account = recovery.publicKey();
  const entry = await server.getAccountEntry(account);
  const tx = (await newTx(account)).addOperation(
    Operation.setOptions({
      masterWeight: MASTER_WEIGHT,
      lowThreshold: 1,
      medThreshold: medium(cosigners),
      highThreshold: HIGH,
      signer: { ed25519PublicKey: device, weight: DEVICE_WEIGHT },
    }),
  );
  for (const c of cosigners) tx.addOperation(Operation.setOptions({ signer: { ed25519PublicKey: c, weight: COSIGNER_WEIGHT } }));
  for (const s of signersOf(entry)) {
    if (s.key !== device && !cosigners.includes(s.key)) tx.addOperation(Operation.setOptions({ signer: { ed25519PublicKey: s.key, weight: 0 } }));
  }
  const built = tx.build();
  built.sign(recovery);
  await submit(built);
}

/** XLM the account must hold for a phone key plus `cosigners` factors: 0.5 per entry (2 base, 1 per key) and a fee. */
export const protectionMinimum = (cosigners: number) => (2 + 1 + cosigners) * 0.5 + 0.01;

export type PaymentRequest = { to: string; amount?: string; memo?: string };

/**
 * What a scanned QR asks for: a bare G… address, or a SEP-7 `web+stellar:pay?destination=…` link
 * (amount and text memo carried over). Anything else, including an S… secret, gives null.
 */
export function parsePaymentQr(text: string): PaymentRequest | null {
  const raw = text.trim();
  if (StrKey.isValidEd25519PublicKey(raw.toUpperCase())) return { to: raw.toUpperCase() };
  if (!raw.toLowerCase().startsWith('web+stellar:pay?')) return null;
  const q = new URLSearchParams(raw.slice(raw.indexOf('?') + 1));
  const to = q.get('destination') ?? '';
  if (!StrKey.isValidEd25519PublicKey(to)) return null;
  // ponytail: only text memos; exchanges using MEMO_ID need Memo.id support in Send first
  const memoType = q.get('memo_type') ?? 'MEMO_TEXT';
  if (q.get('memo') && memoType !== 'MEMO_TEXT') return null;
  return { to, amount: q.get('amount') ?? undefined, memo: q.get('memo') ?? undefined };
}

/** SEP-7 link other wallets understand; what Receive shows as a QR. */
export const paymentUri = (to: string) => `web+stellar:pay?destination=${to}`;
