import { Keypair, Operation } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import { addTokenTx, priceIn, configure, cosignersOf, isConfigured, knownTokens, needs2fa, newTx, server, signersOf, submit, tokenBalance } from './chain';

// what protecting a (new) phone does: this phone in, every other phone out, second factors kept
const rekey = async (recovery: Keypair, device: string) =>
  configure(recovery, device, cosignersOf(await server.getAccountEntry(recovery.publicKey())));

// Talks to testnet (Friendbot + RPC): TESTNET=1 npm test
describe.skipIf(!process.env.TESTNET)('keys on testnet', () => {
  const pay = async (account: string, ...signers: Keypair[]) => {
    const tx = (await newTx(account)).addOperation(Operation.createAccount({ destination: Keypair.random().publicKey(), startingBalance: '1' })).build();
    signers.forEach((k) => tx.sign(k));
    return submit(tx);
  };
  const addSigner = async (account: string, ...signers: Keypair[]) => {
    const tx = (await newTx(account)).addOperation(Operation.setOptions({ signer: { ed25519PublicKey: Keypair.random().publicKey(), weight: 5 } })).build();
    signers.forEach((k) => tx.sign(k));
    return submit(tx);
  };

  it('phone pays alone, never changes keys; restore swaps phones', async () => {
    const recovery = Keypair.random();
    const account = recovery.publicKey();
    await server.fundAddress(account);

    const phone1 = Keypair.random();
    await rekey(recovery, phone1.publicKey());
    expect(isConfigured(await server.getAccountEntry(account), phone1.publicKey(), [])).toBe(true);
    await pay(account, phone1);
    await expect(addSigner(account, phone1)).rejects.toThrow();

    const phone2 = Keypair.random();
    await rekey(recovery, phone2.publicKey());
    expect(signersOf(await server.getAccountEntry(account)).map((s) => s.key)).toEqual([phone2.publicKey()]);
    await expect(pay(account, phone1)).rejects.toThrow();
    await pay(account, phone2);
  }, 120_000);

  it('2FA: phone + YubiKey pays; neither alone; nothing short of the recovery key changes keys', async () => {
    const recovery = Keypair.random();
    const account = recovery.publicKey();
    await server.fundAddress(account);

    // start from the first version's setup (master 2, phone 1, thresholds 1/1/2) to prove the upgrade
    const phone = Keypair.random();
    const legacy = (await newTx(account))
      .addOperation(Operation.setOptions({ masterWeight: 2, lowThreshold: 1, medThreshold: 1, highThreshold: 2, signer: { ed25519PublicKey: phone.publicKey(), weight: 1 } }))
      .build();
    legacy.sign(recovery);
    await submit(legacy);
    expect(cosignersOf(await server.getAccountEntry(account))).toEqual([]); // its weight-1 signer is a phone

    const yubikey = Keypair.random();
    await configure(recovery, phone.publicKey(), [yubikey.publicKey()]);
    let entry = await server.getAccountEntry(account);
    expect(isConfigured(entry, phone.publicKey(), [yubikey.publicKey()])).toBe(true);
    expect(needs2fa(entry)).toBe(true);

    await expect(pay(account, phone)).rejects.toThrow(); // stolen phone alone
    await expect(pay(account, yubikey)).rejects.toThrow(); // YubiKey alone
    await pay(account, phone, yubikey);
    await expect(addSigner(account, phone, yubikey)).rejects.toThrow(); // can't add a thief's key
    await addSigner(account, recovery).then(() => configure(recovery, phone.publicKey(), [yubikey.publicKey()])); // recovery key can

    // lost phone: restore fires the old phone, keeps the YubiKey
    const phone2 = Keypair.random();
    await rekey(recovery, phone2.publicKey());
    entry = await server.getAccountEntry(account);
    expect(isConfigured(entry, phone2.publicKey(), [yubikey.publicKey()])).toBe(true);
    await expect(pay(account, phone, yubikey)).rejects.toThrow();
    await pay(account, phone2, yubikey);

    // lost YubiKey: the recovery key turns 2FA off
    await configure(recovery, phone2.publicKey(), []);
    entry = await server.getAccountEntry(account);
    expect(needs2fa(entry)).toBe(false);
    await pay(account, phone2);
  }, 180_000);

  it('tokens: not added → null, added → 0', async () => {
    const owner = Keypair.random();
    await server.fundAddress(owner.publicKey());
    const usdc = knownTokens()[0];
    expect(await tokenBalance(owner.publicKey(), usdc)).toBeNull();
    const tx = await addTokenTx(owner.publicKey(), usdc);
    tx.sign(owner);
    await submit(tx);
    expect(await tokenBalance(owner.publicKey(), usdc)).toBe(0);
  }, 60_000);

  it('prices: a stablecoin is 1 of its currency, XLM has a USD price', async () => {
    const [usdc, eurc] = knownTokens();
    expect(await priceIn(usdc, 'USD')).toBe(1);
    expect(await priceIn(eurc, 'EUR')).toBe(1);
    expect(await priceIn(undefined, 'XLM')).toBe(1);
    expect(await priceIn(undefined, 'USD')).toBeGreaterThan(0);
  }, 30_000);
});
