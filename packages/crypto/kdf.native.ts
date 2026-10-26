import { scrypt as nativeScrypt } from 'react-native-quick-crypto';

// ponytail: pure-JS scrypt took ~2 min per tag on Hermes; this is OpenSSL in native code.
// Same parameters as kdf.ts.
export const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const scrypt = (password: string, salt: Uint8Array): Promise<Uint8Array> =>
  new Promise((ok, fail) => nativeScrypt(password, salt, 32, SCRYPT, (e, key) => (e ? fail(e) : ok(new Uint8Array(key!)))));
