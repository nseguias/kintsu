import { randomBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export type Words = 12 | 24;

/** SeedSigner's counts: 50 × log2(6) ≈ 129 bits for 12 words, 99 × log2(6) ≈ 256 bits for 24. */
export const DICE_ROLLS: Record<Words, number> = { 12: 50, 24: 99 };

const entropyBytes = (words: Words) => (words === 12 ? 16 : 32);

/** Phone CSPRNG (crypto.getRandomValues → Android SecureRandom). */
export function randomEntropy(words: Words): Uint8Array {
  return randomBytes(entropyBytes(words));
}

/**
 * SeedSigner-exact and reproducible on purpose: SHA-256 of the rolls exactly as typed ("1".."6"),
 * truncated to 16 bytes for 12 words. Never mixed with anything, so the same rolls give the same
 * words on a SeedSigner or with `echo -n <rolls> | sha256sum`.
 */
export function diceEntropy(rolls: string, words: Words): Uint8Array {
  if (!/^[1-6]*$/.test(rolls)) throw new Error('Each roll must be a number from 1 to 6');
  const need = DICE_ROLLS[words];
  if (rolls.length !== need) throw new Error(`${words} words need exactly ${need} rolls (got ${rolls.length})`);
  return sha256(utf8ToBytes(rolls)).slice(0, entropyBytes(words));
}

/**
 * Photos chained into the phone's randomness, SeedSigner-style. Not reproducible on purpose:
 * how random a photo is can't be measured, so the CSPRNG stays the floor.
 */
export function cameraEntropy(photos: Uint8Array[], words: Words): Uint8Array {
  if (photos.length < 2) throw new Error('Take 2 photos');
  let h = sha256(randomBytes(32));
  for (const p of photos) h = sha256(concatBytes(h, p));
  return h.slice(0, entropyBytes(words));
}
