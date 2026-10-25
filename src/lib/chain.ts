import { Asset, Keypair, Memo, Networks, Operation, rpc, StrKey, TransactionBuilder, type Transaction, type xdr } from '@stellar/stellar-sdk';

// No React Native imports here, so chain.test.ts can run it against testnet from Node.
export type Network = 'testnet' | 'mainnet';
// ponytail: SDF runs no public mainnet RPC; Gateway's is free and keyless. Swap for a paid provider if it rate-limits.
const NETWORKS = {
  testnet: { passphrase: Networks.TESTNET, rpc: 'https://soroban-testnet.stellar.org', horizon: 'https://horizon-testnet.stellar.org' },
  mainnet: { passphrase: Networks.PUBLIC, rpc: 'https://soroban-rpc.mainnet.stellar.gateway.fm', horizon: 'https://horizon.stellar.org' },
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

/**
 * An unsigned payment of XLM, or of `token`. XLM to a new address creates its account (needs ≥ 1 XLM);
 * a token can only go to an account that has added it.
 */
export async function paymentTx(from: string, to: string, amount: string, memo = '', token?: Token): Promise<Transaction> {
  const exists = await accountExists(to);
  if (token && (!exists || (await tokenBalance(to, token)) === null)) throw new Error(`That address hasn’t added ${token.code} yet, so it can’t receive it.`);
  const tx = (await newTx(from)).addOperation(
    exists || token
      ? Operation.payment({ destination: to, asset: assetOf(token), amount })
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

/** XLM the account must hold for a phone key plus `cosigners` factors: 0.5 per entry (2 base, tokens, 1 per key) and a fee. */
export const protectionMinimum = (entry: xdr.AccountEntry | null, cosigners: number) =>
  (2 + (entry ? entry.numSubEntries - signersOf(entry).length : 0) + 1 + cosigners) * 0.5 + 0.01;

/**
 * Tokens Shards offers. On Stellar anyone can issue a token called "USDC", so a token is code +
 * issuer, and we only list issuers we checked (Circle's docs, 2026-10-25).
 */
export type Token = { code: string; issuer: string; name: string };
const TOKENS: Record<Network, Token[]> = {
  testnet: [
    { code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', name: 'USD Coin' },
    { code: 'EURC', issuer: 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO', name: 'Euro Coin' },
  ],
  mainnet: [
    { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', name: 'USD Coin' },
    { code: 'EURC', issuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2', name: 'Euro Coin' },
  ],
};
export const knownTokens = () => TOKENS[network];
export const horizonUrl = () => NETWORKS[network].horizon;
const assetOf = (t?: Token) => (t ? new Asset(t.code, t.issuer) : Asset.native());

export type Currency = 'USD' | 'EUR' | 'XLM';
// each currency is priced in the stablecoin that tracks it (XLM: itself)
const PEG: Record<Currency, string | undefined> = { USD: 'USDC', EUR: 'EURC', XLM: undefined };

const assetParam = (prefix: string, t?: Token) =>
  t ? `${prefix}_asset_type=credit_alphanum${t.code.length > 4 ? 12 : 4}&${prefix}_asset_code=${t.code}&${prefix}_asset_issuer=${t.issuer}` : `${prefix}_asset_type=native`;

/** What `amount` of `from` buys of `to` on Stellar's mainnet exchange right now (best path), or null. */
async function quote(from: Token | undefined, to: Token | undefined, amount: number): Promise<number | null> {
  const res = await fetch(`${NETWORKS.mainnet.horizon}/paths/strict-send?${assetParam('source', from)}&source_amount=${amount.toFixed(7)}&destination_assets=${to ? `${to.code}:${to.issuer}` : 'native'}`);
  if (!res.ok) return null;
  const best = (await res.json())._embedded?.records?.[0];
  return best ? Number(best.destination_amount) : null;
}

/**
 * What 1 unit of `from` is worth in `currency`, from Stellar's mainnet exchange, even on testnet (testnet
 * prices are made up): testnet USDC/EURC count as the real ones, unchecked tokens get no price.
 * The stablecoin itself counts as
 * exactly 1. Null when there's no real market: selling back what 1 unit buys must return ≥95% of it,
 * otherwise one stray offer in an empty order book would set the price.
 * ponytail: a 1-unit quote is the spot price; big balances would fetch less (slippage), fine for a total.
 */
export async function priceIn(from: Token | undefined, currency: Currency): Promise<number | null> {
  const peg = PEG[currency];
  const to = peg ? TOKENS.mainnet.find((t) => t.code === peg) : undefined;
  if (from) {
    const { code, issuer } = from;
    if (!knownTokens().some((t) => t.code === code && t.issuer === issuer)) return null;
    from = TOKENS.mainnet.find((t) => t.code === code);
  }
  if (from?.code === to?.code) return 1;
  const price = await quote(from, to, 1);
  if (!price) return null;
  const back = await quote(to, from, price);
  return back !== null && back >= 0.95 ? price : null;
}

/** What the account holds of a known token: null if it hasn't added it (no trustline). */
export async function tokenBalance(address: string, t: Token): Promise<number | null> {
  try {
    const { balanceEntry } = await server.getAssetBalance(address, assetOf(t), NETWORK_PASSPHRASE);
    return balanceEntry ? Number(balanceEntry.amount) / 1e7 : null;
  } catch (e) {
    if (String(e).includes('not found')) return null; // the SDK throws for a missing trustline
    throw e; // network trouble: don't act on a guess
  }
}

/** Adding a token = a trustline: the account agrees to hold it. Locks 0.5 XLM. */
export const addTokenTx = async (account: string, t: Token) => (await newTx(account)).addOperation(Operation.changeTrust({ asset: assetOf(t) })).build();

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

export type Activity = { id: string; incoming: boolean; other: string; amount: string; code: string; at: string; tx: string };

/** Horizon payment records (payment, create_account, path payments) → what History shows. Others are skipped. */
export function toActivity(me: string, records: Record<string, string>[]): Activity[] {
  return records.flatMap((r) => {
    const base = { id: r.id, at: r.created_at, tx: r.transaction_hash };
    if (r.type === 'create_account') {
      const incoming = r.account === me;
      return [{ ...base, incoming, other: incoming ? r.funder : r.account, amount: r.starting_balance, code: 'XLM' }];
    }
    if (r.type === 'payment' || r.type.startsWith('path_payment')) {
      const incoming = r.to === me;
      return [{ ...base, incoming, other: incoming ? r.from : r.to, amount: r.amount, code: r.asset_type === 'native' ? 'XLM' : r.asset_code }];
    }
    return [];
  });
}

/** Latest payments in and out of `address`, newest first. RPC has no per-account history, so this reads Horizon. */
export async function recentActivity(address: string, limit = 5): Promise<Activity[]> {
  const res = await fetch(`${horizonUrl()}/accounts/${address}/payments?order=desc&limit=${limit}`);
  if (res.status === 404) return []; // account not opened yet
  if (!res.ok) throw new Error(`History unavailable (${res.status})`);
  return toActivity(address, (await res.json())._embedded.records);
}

/** Where a transaction can be inspected publicly. */
export const explorerUrl = (tx: string) => `https://stellar.expert/explorer/${network === 'mainnet' ? 'public' : 'testnet'}/tx/${tx}`;
