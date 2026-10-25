import { describe, expect, it } from 'vitest';

import { toActivity } from './chain';

describe('history rows', () => {
  const me = 'GME';
  const base = { id: '1', created_at: '2026-10-25T10:00:00Z', transaction_hash: 'abc' };

  it('reads payments both ways, account creation and path payments; skips the rest', () => {
    const rows = toActivity(me, [
      { ...base, type: 'payment', from: 'GBOB', to: me, amount: '5.0000000', asset_type: 'credit_alphanum4', asset_code: 'USDC' },
      { ...base, type: 'payment', from: me, to: 'GBOB', amount: '1.0000000', asset_type: 'native' },
      { ...base, type: 'create_account', funder: 'GFRIEND', account: me, starting_balance: '10000.0000000' },
      { ...base, type: 'path_payment_strict_send', from: me, to: me, amount: '86.8', asset_type: 'credit_alphanum4', asset_code: 'USDC', source_amount: '100.0000000', source_asset_type: 'native' },
      { ...base, type: 'change_trust' },
    ]);
    expect(rows.map((r) => r.sold)).toEqual([undefined, undefined, undefined, '100 XLM']);
    expect(rows.map((r) => [r.incoming, r.other, r.amount, r.code])).toEqual([
      [true, 'GBOB', '5.0000000', 'USDC'],
      [false, 'GBOB', '1.0000000', 'XLM'],
      [true, 'GFRIEND', '10000.0000000', 'XLM'],
      [true, me, '86.8', 'USDC'],
    ]);
  });
});
