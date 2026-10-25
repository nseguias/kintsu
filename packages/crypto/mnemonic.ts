import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { entropyToMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export { wordlist };

export const toMnemonic = (entropy: Uint8Array) => entropyToMnemonic(entropy, wordlist);
export const isValidMnemonic = (mnemonic: string) => validateMnemonic(mnemonic, wordlist);

/**
 * SEP-0005: BIP39 seed → SLIP-10 ed25519 at m/44'/148'/account' (all hardened).
 * Returns the 32-byte ed25519 seed for Keypair.fromRawEd25519Seed. A wrong passphrase
 * silently yields a different valid wallet; that's BIP39, not a bug.
 */
export function stellarSeed(mnemonic: string, passphrase = '', account = 0): Uint8Array {
  if (!isValidMnemonic(mnemonic)) throw new Error('Invalid recovery phrase');
  let I = hmac(sha512, utf8ToBytes('ed25519 seed'), mnemonicToSeedSync(mnemonic, passphrase));
  for (const index of [44, 148, account]) {
    const data = new Uint8Array(37); // 0x00 ‖ key ‖ ser32(index + 2^31)
    data.set(I.subarray(0, 32), 1);
    new DataView(data.buffer).setUint32(33, (index | 0x80000000) >>> 0);
    I = hmac(sha512, I.subarray(32), data);
  }
  return I.slice(0, 32);
}
