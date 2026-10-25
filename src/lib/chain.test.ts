import { Keypair, Operation } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import { isRekeyedTo, newTx, rekey, server, signersOf, submit } from './chain';

// Talks to testnet (Friendbot + RPC): TESTNET=1 npm test
describe.skipIf(!process.env.TESTNET)('re-key on testnet', () => {
  const pay = async (account: string, signer: Keypair) => {
    const tx = (await newTx(account)).addOperation(Operation.createAccount({ destination: Keypair.random().publicKey(), startingBalance: '1' })).build();
    tx.sign(signer);
    return submit(tx);
  };

  it('device key pays but can never change signers; recovery key swaps phones', async () => {
    const recovery = Keypair.random();
    const account = recovery.publicKey();
    await server.fundAddress(account);

    const phone1 = Keypair.random();
    await rekey(recovery, phone1.publicKey());
    expect(isRekeyedTo(await server.getAccountEntry(account), phone1.publicKey())).toBe(true);

    await pay(account, phone1); // medium threshold: device alone is enough

    // high threshold: the device key can't add a signer (e.g. a thief adding their own key)
    const grab = (await newTx(account))
      .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: Keypair.random().publicKey(), weight: 2 } }))
      .build();
    grab.sign(phone1);
    await expect(submit(grab)).rejects.toThrow();

    // lost phone: restore the recovery key, give the new phone its own key, the old one is fired
    const phone2 = Keypair.random();
    await rekey(recovery, phone2.publicKey());
    const entry = await server.getAccountEntry(account);
    expect(isRekeyedTo(entry, phone2.publicKey())).toBe(true);
    expect(signersOf(entry).map((s) => s.key)).not.toContain(phone1.publicKey());
    await expect(pay(account, phone1)).rejects.toThrow();
    await pay(account, phone2);
  }, 120_000);
});
