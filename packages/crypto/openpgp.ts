import { sha1 } from '@noble/hashes/legacy.js';
import { concatBytes } from '@noble/hashes/utils.js';

// OpenPGP card algorithm attributes for Ed25519 signing: EdDSA (22) + the Ed25519 curve OID.
export const ED25519_OID = Uint8Array.of(0x2b, 0x06, 0x01, 0x04, 0x01, 0xda, 0x47, 0x0f, 0x01);
export const ED25519_ATTRIBUTES = concatBytes(Uint8Array.of(22), ED25519_OID);

/**
 * OpenPGP v4 fingerprint of an Ed25519 (EdDSA, algo 22) public key created at `created` (unix s).
 * Stored on the YubiKey next to the key so gpg and other tools see the slot as taken.
 * Only SHA-1 because that's what v4 fingerprints are defined as; nothing here relies on it for security.
 */
export function ed25519Fingerprint(pub: Uint8Array, created: number): Uint8Array {
  const time = Uint8Array.of(created >>> 24, (created >>> 16) & 255, (created >>> 8) & 255, created & 255);
  // MPI of 0x40‖pub: 33 bytes whose top byte 0x40 has 7 significant bits → 263 bits
  const body = concatBytes(Uint8Array.of(4), time, Uint8Array.of(22, ED25519_OID.length), ED25519_OID, Uint8Array.of(0x01, 0x07, 0x40), pub);
  return sha1(concatBytes(Uint8Array.of(0x99, body.length >> 8, body.length & 255), body));
}

/** Finds a BER-TLV tag's value inside `data` (one level, 1- or 2-byte tags, short or 0x81/0x82 lengths). */
export function tlv(data: number[], tag: number): number[] | undefined {
  for (let i = 0; i < data.length; ) {
    let t = data[i++];
    if ((t & 0x1f) === 0x1f) t = (t << 8) | data[i++];
    let len = data[i++];
    if (len === 0x81) len = data[i++];
    else if (len === 0x82) len = (data[i++] << 8) | data[i++];
    if (t === tag) return data.slice(i, i + len);
    // constructed tags (bit 6 of the first byte) hold the ones we want: look inside
    if (((t > 0xff ? t >> 8 : t) & 0x20) !== 0) {
      const inner = tlv(data.slice(i, i + len), tag);
      if (inner) return inner;
    }
    i += len;
  }
}
