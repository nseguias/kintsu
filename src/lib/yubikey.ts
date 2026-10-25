import { ED25519_ATTRIBUTES, ed25519Fingerprint, tlv } from '@crypto/openpgp';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

import { simulated } from '@/lib/nfc';

// Talks to the YubiKey's OpenPGP app over NFC (ISO 7816 APDUs), the same commands we first ran
// from the Mac with gpg-connect-agent. Only the OpenPGP *signing* slot is ever touched; FIDO
// (Gmail/X logins), OTP, PIV and OATH are separate apps these commands can't reach.

export class YubiKeyError extends Error {}

type Send = (apdu: number[]) => Promise<number[]>;

const bytes = (s: string) => Array.from(new TextEncoder().encode(s.normalize('NFKC')));
const SELECT_OPENPGP = [0x00, 0xa4, 0x04, 0x00, 0x06, 0xd2, 0x76, 0x00, 0x01, 0x24, 0x01, 0x00];
const READ_SIGNING_KEY = [0x00, 0x47, 0x81, 0x00, 0x02, 0xb6, 0x00, 0x00];
const GENERATE_SIGNING_KEY = [0x00, 0x47, 0x80, 0x00, 0x02, 0xb6, 0x00, 0x00];
const verify = (pw: 0x81 | 0x83, pin: string) => [0x00, 0x20, 0x00, pw, bytes(pin).length, ...bytes(pin)];
const putData = (tag: number, data: ArrayLike<number>) => [0x00, 0xda, 0x00, tag, data.length, ...Array.from(data)];

function swError(sw: number): YubiKeyError {
  if ((sw & 0xfff0) === 0x63c0) return new YubiKeyError(`Wrong PIN. ${sw & 0xf} tries left before it locks.`);
  if (sw === 0x6983) return new YubiKeyError('This PIN is locked after too many wrong tries.');
  return new YubiKeyError(`The YubiKey refused (${sw.toString(16).toUpperCase()}).`);
}

/** Opens one NFC session with the YubiKey's OpenPGP app; the caller's whole flow runs in one tap. */
async function session<T>(fn: (send: Send) => Promise<T>): Promise<T> {
  try {
    await NfcManager.requestTechnology(NfcTech.IsoDep);
    await NfcManager.setTimeout(5000).catch(() => {}); // Android only; key generation can take a moment
    const raw = (a: number[]) => NfcManager.isoDepHandler.transceive(a);
    const send: Send = async (apdu) => {
      const data: number[] = [];
      let r = await raw(apdu);
      while (r[r.length - 2] === 0x61) {
        data.push(...r.slice(0, -2)); // more data waiting: GET RESPONSE
        r = await raw([0x00, 0xc0, 0x00, 0x00, r[r.length - 1]]);
      }
      const sw = (r[r.length - 2] << 8) | r[r.length - 1];
      if (sw !== 0x9000) throw swError(sw);
      return [...data, ...r.slice(0, -2)];
    };
    await send(SELECT_OPENPGP);
    return await fn(send);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

/** The signing slot's Ed25519 key (and whether gpg can see it); null if empty; refuses anything else. */
async function readSigningKey(send: Send): Promise<{ pub: Uint8Array; recorded: boolean } | null> {
  const appData = await send([0x00, 0xca, 0x00, 0x6e, 0x00]);
  const fingerprint = tlv(appData, 0xc5)?.slice(0, 20) ?? [];
  let pub: number[] | undefined;
  try {
    pub = tlv(await send(READ_SIGNING_KEY), 0x86);
  } catch {
    pub = undefined; // the YubiKey answers "not found" for an empty slot
  }
  if (pub?.length === 32) return { pub: Uint8Array.from(pub), recorded: fingerprint.some((b) => b !== 0) };
  // anything else in the slot (an RSA/ECC key, or a fingerprint gpg recorded) is someone's key: hands off
  if (pub || fingerprint.some((b) => b !== 0)) {
    throw new YubiKeyError('This YubiKey’s OpenPGP signing slot already holds a different key. Shards won’t touch it.');
  }
  return null;
}

const retriesLeft = async (send: Send, pw: 0x81 | 0x83) => {
  const status = tlv(await send([0x00, 0xca, 0x00, 0x6e, 0x00]), 0xc4) ?? [];
  return pw === 0x81 ? status[4] : status[6]; // C4: format, 3 max lengths, then PW1 / RC / PW3 counters
};

async function checkPin(send: Send, pw: 0x81 | 0x83, pin: string) {
  // never spend the last try: a locked OpenPGP app needs a reset, which we never do
  if ((await retriesLeft(send, pw)) <= 1) throw new YubiKeyError('Only one PIN try left. Unlock it with Yubico’s tools first.');
  await send(verify(pw, pin));
}

// ponytail: the emulator has no NFC, so it gets a pretend YubiKey that lives in memory.
let simKey: Keypair | undefined;

/**
 * One tap: returns the YubiKey's Stellar address. Creates the Ed25519 signing key only if the
 * OpenPGP signing slot is empty; an existing Ed25519 key is reused; any other key is refused.
 */
export async function setupYubiKey(adminPin: string, pin?: string): Promise<string> {
  if (await simulated) return (simKey ??= Keypair.random()).publicKey();
  return session(async (send) => {
    const existing = await readSigningKey(send);
    // also check the signing PIN now, so 2FA is never turned on with a PIN that then fails at send time
    if (existing?.recorded) {
      if (pin) await checkPin(send, 0x81, pin);
      return StrKey.encodeEd25519PublicKey(Buffer.from(existing.pub));
    }
    await checkPin(send, 0x83, adminPin);
    let pub = existing?.pub;
    if (!pub) {
      await send(putData(0xc1, ED25519_ATTRIBUTES));
      pub = Uint8Array.from(tlv(await send(GENERATE_SIGNING_KEY), 0x86) ?? []);
      if (pub.length !== 32) throw new YubiKeyError('The YubiKey didn’t return a key. Try again.');
    }
    // record fingerprint + creation time so gpg and other tools see this slot as taken
    const created = Math.floor(Date.now() / 1000);
    await send(putData(0xc7, ed25519Fingerprint(pub, created)));
    await send(putData(0xce, [created >>> 24, (created >>> 16) & 255, (created >>> 8) & 255, created & 255]));
    if (pin) await checkPin(send, 0x81, pin);
    return StrKey.encodeEd25519PublicKey(Buffer.from(pub));
  });
}

/** One tap: signs a 32-byte transaction hash. Checks it's the YubiKey we expect before asking for the PIN. */
export async function signWithYubiKey(hash: Uint8Array, pin: string, expected?: string): Promise<{ address: string; signature: Uint8Array }> {
  if (await simulated) {
    if (!simKey) throw new YubiKeyError('Set up the YubiKey first.');
    return { address: simKey.publicKey(), signature: simKey.sign(Buffer.from(hash)) };
  }
  return session(async (send) => {
    const key = await readSigningKey(send);
    if (!key) throw new YubiKeyError('This YubiKey has no signing key yet. Set it up first.');
    const address = StrKey.encodeEd25519PublicKey(Buffer.from(key.pub));
    if (expected && address !== expected) throw new YubiKeyError('That’s a different YubiKey than the one on this wallet.');
    await checkPin(send, 0x81, pin);
    const signature = Uint8Array.from(await send([0x00, 0x2a, 0x9e, 0x9a, hash.length, ...Array.from(hash), 0x00]));
    if (!Keypair.fromPublicKey(address).verify(Buffer.from(hash), Buffer.from(signature))) {
      throw new YubiKeyError('The YubiKey’s signature didn’t check out.');
    }
    return { address, signature };
  });
}
