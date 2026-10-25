import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';

import { ed25519Fingerprint, tlv } from './openpgp';

describe('OpenPGP fingerprint', () => {
  it('matches the RFC 9580 sample v4 Ed25519 key', () => {
    // RFC 9580 A.3: created 0x53f35f0b, key 3f098994…24 06
    const pub = hexToBytes('3f098994bdd916ed4053197934e4a87c80733a1280d62f8010992e43ee3b2406');
    expect(bytesToHex(ed25519Fingerprint(pub, 0x53f35f0b))).toBe('c959bdbafa32a2f89a153b678cfde12197965a9a');
  });
});

describe('reading YubiKey replies', () => {
  const hex = (s: string) => Array.from(hexToBytes(s.replace(/ /g, '')));

  it('finds the public key in the real key-generation reply', () => {
    const reply = hex('7F4922 8620 0904A019CAAF230E99F3F42B665BB2BCA297479FC45FD0FC4FF04090C454C04C');
    expect(bytesToHex(Uint8Array.from(tlv(reply, 0x86)!))).toBe('0904a019caaf230e99f3f42b665bb2bca297479fc45fd0fc4ff04090c454c04c');
  });

  it('finds key attributes and PIN counters nested inside application data', () => {
    // the real 6E reply from this YubiKey (cut after C4): AID, historical bytes, 7F74, then 73 { C0 C1 C2 C3 DA C4 }
    const appData = hex(
      '6E820137 4F10D2760001240103040006234506200000 5F52080073 0000E0059000 7F7403810120 73820110' +
        ' C00A7D000BFE080000FF0000 C106010800001100 C206010800001100 C306010800001100 DA06010800001100 C407017F7F7F030003',
    );
    expect(tlv(appData, 0xc1)).toEqual([0x01, 0x08, 0x00, 0x00, 0x11, 0x00]);
    expect(tlv(appData, 0xc4)?.[4]).toBe(3); // PIN tries left
    expect(tlv(appData, 0xc4)?.[6]).toBe(3); // admin PIN tries left
    expect(tlv(appData, 0x86)).toBeUndefined();
  });
});
