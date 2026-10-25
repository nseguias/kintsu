import { Keypair, Networks, Operation, rpc, StrKey, TransactionBuilder, type Transaction, type xdr } from '@stellar/stellar-sdk';

// ponytail: testnet only; mainnet needs real funding instead of Friendbot.
// No React Native imports here, so chain.test.ts can run it against testnet from Node.
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const server = new rpc.Server('https://soroban-testnet.stellar.org');

// Weights: the recovery key (account master) can do anything alone; the device key can pay but
// never meet the high threshold, so it can't change signers or lock the recovery key out.
export const MASTER_WEIGHT = 2;
export const DEVICE_WEIGHT = 1;
const THRESHOLDS = { lowThreshold: 1, medThreshold: 1, highThreshold: 2 };

export const newTx = async (account: string) =>
  new TransactionBuilder(await server.getAccount(account), { fee: '1000', networkPassphrase: NETWORK_PASSPHRASE }).setTimeout(60);

/** Sends a signed transaction and waits for the ledger to accept or reject it. */
export async function submit(tx: Transaction): Promise<void> {
  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error(`Rejected: ${sent.errorResult?.result.type ?? 'unknown'}`);
  const done = await server.pollTransaction(sent.hash);
  if (done.status !== 'SUCCESS') throw new Error(`Transaction ${done.status}`);
}

/** Extra ed25519 signers on the account (the master key isn't listed). */
export const signersOf = (entry: xdr.AccountEntry) =>
  entry.signers.flatMap((s) =>
    s.key.type === 'signerKeyTypeEd25519' ? [{ key: StrKey.encodeEd25519PublicKey(Buffer.from(s.key.ed25519.value)), weight: s.weight }] : [],
  );

/** True once `device` is the only extra signer and the weights/thresholds are ours. */
export function isRekeyedTo(entry: xdr.AccountEntry, device: string): boolean {
  const [master, low, med, high] = entry.thresholds.value;
  const signers = signersOf(entry);
  return (
    master === MASTER_WEIGHT &&
    low === THRESHOLDS.lowThreshold &&
    med === THRESHOLDS.medThreshold &&
    high === THRESHOLDS.highThreshold &&
    signers.length === 1 &&
    signers[0].key === device &&
    signers[0].weight === DEVICE_WEIGHT
  );
}

/**
 * One atomic transaction signed by the recovery key: sets the weights and thresholds, adds `device`,
 * and removes every other extra signer (old phones). Used for the first re-key and after a restore.
 * ponytail: removes *all* other ed25519 signers; an imported account with someone else's co-signers
 * loses them. Fine for wallets made here; ask first if we ever import shared accounts.
 */
export async function rekey(recovery: Keypair, device: string): Promise<void> {
  const account = recovery.publicKey();
  const entry = await server.getAccountEntry(account);
  const tx = (await newTx(account)).addOperation(
    Operation.setOptions({ masterWeight: MASTER_WEIGHT, ...THRESHOLDS, signer: { ed25519PublicKey: device, weight: DEVICE_WEIGHT } }),
  );
  for (const s of signersOf(entry)) {
    if (s.key !== device) tx.addOperation(Operation.setOptions({ signer: { ed25519PublicKey: s.key, weight: 0 } }));
  }
  const built = tx.build();
  built.sign(recovery);
  await submit(built);
}
