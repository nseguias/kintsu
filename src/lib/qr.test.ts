import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import { parsePaymentQr, paymentUri } from './chain';

describe('payment QR codes', () => {
  const g = Keypair.random().publicKey();

  it('reads a bare address and our own Receive QR', () => {
    expect(parsePaymentQr(` ${g.toLowerCase()} `)).toEqual({ to: g });
    expect(parsePaymentQr(paymentUri(g))).toEqual({ to: g, amount: undefined, memo: undefined });
  });

  it('carries amount and text memo from SEP-7', () => {
    expect(parsePaymentQr(`web+stellar:pay?destination=${g}&amount=12.5&memo=coffee%20%231`)).toEqual({ to: g, amount: '12.5', memo: 'coffee #1' });
  });

  it('refuses secrets, junk and memo types Send can’t honour', () => {
    expect(parsePaymentQr(Keypair.random().secret())).toBeNull();
    expect(parsePaymentQr('https://example.com')).toBeNull();
    expect(parsePaymentQr(`web+stellar:pay?destination=${g}&memo=123&memo_type=MEMO_ID`)).toBeNull();
  });
});
