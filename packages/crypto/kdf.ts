import { scrypt as nodeScrypt } from 'node:crypto';

// Tests run here; the app gets kdf.native.ts (Metro prefers .native.ts). Both are OpenSSL's scrypt
// behind the same Node API; crypto.test.ts checks this one against @noble/hashes byte for byte.
export const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const scrypt = (password: string, salt: Uint8Array): Promise<Uint8Array> =>
  new Promise((ok, fail) => nodeScrypt(password, salt, 32, SCRYPT, (e, key) => (e ? fail(e) : ok(new Uint8Array(key)))));
