import { describe, expect, it } from 'vitest';
// the pure-JS NDEF codec the app uses (the package root needs React Native); same API as the typed `Ndef`
import type { Ndef as NdefT } from 'react-native-nfc-manager';
// @ts-expect-error untyped deep import
import NdefLib from 'react-native-nfc-manager/dist/ndef-lib/index.js';

const Ndef = NdefLib as typeof NdefT;

import { SHARD_BYTES, createShards } from './shards';

describe('tag record', () => {
  it('a shard survives NDEF encode/decode byte for byte, as a clue-free MIME record', async () => {
    const [shard] = await createShards(new Uint8Array(32).fill(7), '123456');
    const bytes = Ndef.encodeMessage([Ndef.record(Ndef.TNF_MIME_MEDIA, 'application/octet-stream', [], Array.from(shard))]);
    const [r] = Ndef.decodeMessage(bytes);
    expect(Uint8Array.from(r.payload)).toEqual(shard);
    expect(r.payload).toHaveLength(SHARD_BYTES);
    expect(r.type).toBe('application/octet-stream');
    expect(r.id).toHaveLength(0);
    expect(bytes.length).toBeLessThan(144); // fits even the smallest common tag (NTAG213)
  });
});
