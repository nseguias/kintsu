import { Keypair } from '@stellar/stellar-sdk';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { concatBytes, equalBytes, randomBytes } from '@noble/ciphers/utils.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { combine, split } from 'shamir-secret-sharing';

// Tag bytes: salt(16) ‖ nonce(24) ‖ XChaCha20-Poly1305( v(1) ‖ idx(1) ‖ fp(4) ‖ share(33) ).
// Everything that could identify the tag (version, index, 2-of-3, wallet fingerprint) is inside
// the ciphertext and every tag has its own salt, so a tag is indistinguishable from random bytes
// and two tags can't be linked without the PIN.
const VERSION = 1;
const SALT = 16;
const NONCE = 24;
const PLAIN = 1 + 1 + 4 + 33;
export const SHARD_BYTES = SALT + NONCE + PLAIN + 16; // 95; MIFARE Classic 1K holds 716
export const MIN_PIN = 6;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 }; // ~1 s per tag on a phone

export type Shard = { idx: number; fp: Uint8Array; share: Uint8Array };

const fingerprint = (seed: Uint8Array) =>
  sha256(Keypair.fromRawEd25519Seed(Buffer.from(seed)).rawPublicKey()).slice(0, 4);

const keyFor = (pin: string, salt: Uint8Array) => scryptAsync(pin.normalize('NFKC'), salt, SCRYPT);

/** Splits a 32-byte ed25519 seed 2-of-3 and encrypts each share under the PIN. Works for any wallet, created or imported. */
export async function createShards(seed: Uint8Array, pin: string): Promise<Uint8Array[]> {
  if (seed.length !== 32) throw new Error('Seed must be 32 bytes');
  if (pin.length < MIN_PIN) throw new Error(`PIN must be at least ${MIN_PIN} characters`);
  const fp = fingerprint(seed);
  const shares = await split(seed, 3, 2);
  return Promise.all(
    shares.map(async (share, idx) => {
      const salt = randomBytes(SALT);
      const nonce = randomBytes(NONCE);
      const plain = concatBytes(Uint8Array.of(VERSION, idx), fp, share);
      const ct = xchacha20poly1305(await keyFor(pin, salt), nonce).encrypt(plain);
      return concatBytes(salt, nonce, ct);
    }),
  );
}

/** Decrypts one tag. Wrong PIN and "not one of our tags" are deliberately the same error. */
export async function openShard(bytes: Uint8Array, pin: string): Promise<Shard> {
  if (bytes.length !== SHARD_BYTES) throw new Error('Wrong PIN or not a backup tag');
  const salt = bytes.subarray(0, SALT);
  const nonce = bytes.subarray(SALT, SALT + NONCE);
  let plain: Uint8Array;
  try {
    plain = xchacha20poly1305(await keyFor(pin, salt), nonce).decrypt(bytes.subarray(SALT + NONCE));
  } catch {
    throw new Error('Wrong PIN or not a backup tag');
  }
  if (plain[0] !== VERSION) throw new Error(`Unsupported backup version ${plain[0]}`);
  return { idx: plain[1], fp: plain.slice(2, 6), share: plain.slice(6) };
}

/** Rebuilds the seed from two opened tags and checks it is the wallet they were made from. */
export async function combineShards(a: Shard, b: Shard): Promise<Uint8Array> {
  if (a.idx === b.idx) throw new Error('That is the same tag twice; tap a different one');
  if (!equalBytes(a.fp, b.fp)) throw new Error('These tags belong to different wallets');
  const seed = await combine([a.share, b.share]);
  if (!equalBytes(fingerprint(seed), a.fp)) throw new Error('Tags are damaged: the result does not match the wallet');
  return seed;
}
