// usage: node give-usdc.js <G-destination> [xlmToSpend]  — testnet only
const { Keypair, rpc, Asset, Operation, TransactionBuilder, Networks } = require('@stellar/stellar-sdk');
const s = new rpc.Server('https://soroban-testnet.stellar.org');
const USDC = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
(async () => {
  const [to, spend = '200'] = process.argv.slice(2);
  const helper = Keypair.random();
  await s.fundAddress(helper.publicKey());
  const tx = new TransactionBuilder(await s.getAccount(helper.publicKey()), { fee: '1000', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.pathPaymentStrictSend({ sendAsset: Asset.native(), sendAmount: spend, destination: to, destAsset: USDC, destMin: '1', path: [] }))
    .setTimeout(60).build();
  tx.sign(helper);
  const sent = await s.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error(JSON.stringify(sent.errorResult?.result()?.results?.()?.[0]?.value?.()?.value?.()?.switch?.()?.name ?? sent.errorResult));
  const done = await s.pollTransaction(sent.hash);
  console.log(done.status, sent.hash);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
