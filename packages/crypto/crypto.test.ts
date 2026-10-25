import { scryptAsync } from '@noble/hashes/scrypt.js';
import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import {
  cameraEntropy,
  combineShards,
  createShards,
  diceEntropy,
  isValidMnemonic,
  openShard,
  randomEntropy,
  SHARD_BYTES,
  stellarSeed,
  toMnemonic,
} from './index';
import { SCRYPT, scrypt } from './kdf';

const keypair = (seed: Uint8Array) => Keypair.fromRawEd25519Seed(Buffer.from(seed));

// https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md#test-cases
const SEP5 = [
  {
    mnemonic: 'illness spike retreat truth genius clock brain pass fit cave bargain toe',
    passphrase: '',
    accounts: [
      ['GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6', 'SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMN'],
      ['GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX', 'SCEPFFWGAG5P2VX5DHIYK3XEMZYLTYWIPWYEKXFHSK25RVMIUNJ7CTIS'],
    ],
  },
  {
    mnemonic: 'resource asthma orphan phone ice canvas fire useful arch jewel impose vague theory cushion top',
    passphrase: '',
    accounts: [
      ['GAVXVW5MCK7Q66RIBWZZKZEDQTRXWCZUP4DIIFXCCENGW2P6W4OA34RH', 'SAKS7I2PNDBE5SJSUSU2XLJ7K5XJ3V3K4UDFAHMSBQYPOKE247VHAGDB'],
      ['GDFCYVCICATX5YPJUDS22KM2GW5QU2KKSPPPT2IC5AQIU6TP3BZSLR5K', 'SAZ2H5GLAVWCUWNPQMB6I3OHRI63T2ACUUAWSH7NAGYYPXGIOPLPW3Q4'],
    ],
  },
  {
    mnemonic:
      'bench hurt jump file august wise shallow faculty impulse spring exact slush thunder author capable act festival slice deposit sauce coconut afford frown better',
    passphrase: '',
    accounts: [
      ['GC3MMSXBWHL6CPOAVERSJITX7BH76YU252WGLUOM5CJX3E7UCYZBTPJQ', 'SAEWIVK3VLNEJ3WEJRZXQGDAS5NVG2BYSYDFRSH4GKVTS5RXNVED5AX7'],
      ['GB3MTYFXPBZBUINVG72XR7AQ6P2I32CYSXWNRKJ2PV5H5C7EAM5YYISO', 'SBKSABCPDWXDFSZISAVJ5XKVIEWV4M5O3KBRRLSPY3COQI7ZP423FYB4'],
    ],
  },
  {
    mnemonic:
      'cable spray genius state float twenty onion head street palace net private method loan turn phrase state blanket interest dry amazing dress blast tube',
    passphrase: 'p4ssphr4se',
    accounts: [
      ['GDAHPZ2NSYIIHZXM56Y36SBVTV5QKFIZGYMMBHOU53ETUSWTP62B63EQ', 'SAFWTGXVS7ELMNCXELFWCFZOPMHUZ5LXNBGUVRCY3FHLFPXK4QPXYP2X'],
      ['GDY47CJARRHHL66JH3RJURDYXAMIQ5DMXZLP3TDAUJ6IN2GUOFX4OJOC', 'SBQPDFUGLMWJYEYXFRM5TQX3AX2BR47WKI4FDS7EJQUSEUUVY72MZPJF'],
    ],
  },
  {
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    passphrase: '',
    accounts: [
      ['GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX', 'SBUV3MRWKNS6AYKZ6E6MOUVF2OYMON3MIUASWL3JLY5E3ISDJFELYBRZ'],
      ['GDVSYYTUAJ3ACHTPQNSTQBDQ4LDHQCMNY4FCEQH5TJUMSSLWQSTG42MV', 'SCHDCVCWGAKGIMTORV6K5DYYV3BY4WG3RA4M6MCBGJLHUCWU2MC6DL66'],
    ],
  },
];

// https://github.com/SeedSigner/seedsigner/blob/main/tests/test_mnemonic_generation.py
const SEEDSIGNER_DICE: [string, string][] = [
  ['12345612345612345612345612345612345612345612345612', 'unveil nice picture region tragic fault cream strike tourist control recipe tourist'],
  ['11111111111111111111111111111111111111111111111111', 'diet glad hat rural panther lawsuit act drop gallery urge where fit'],
  ['66666666666666666666666666666666666666666666666666', 'senior morning song proud recycle toy search apple trigger lend vibrant arrest'],
  [
    '5'.padEnd(45, '2') + '5'.repeat(54),
    'resource timber firm banner horror pupil frozen main pear direct pioneer broken grid core insane begin sister pony end debate task silk empty curious',
  ],
  [
    '2'.repeat(45) + '5'.repeat(54),
    'garden uphold level clog sword globe armor issue two cute scorpion improve verb artwork blind tail raw butter combine move produce foil feature wave',
  ],
  [
    '2'.repeat(45) + '5'.repeat(53) + '6',
    'lizard broken love tired depend eyebrow excess lonely advance father various cram ignore panic feed plunge miss regret boring unique galaxy fan detail fly',
  ],
];

describe('SEP-0005 phrase → Stellar key', () => {
  for (const v of SEP5) {
    it(`${v.mnemonic.split(' ').slice(0, 2).join(' ')}… ${v.passphrase ? '(passphrase)' : ''}`, () => {
      v.accounts.forEach(([pub, secret], account) => {
        const kp = keypair(stellarSeed(v.mnemonic, v.passphrase, account));
        expect(kp.publicKey()).toBe(pub);
        expect(kp.secret()).toBe(secret);
      });
    });
  }

  it('rejects a phrase with a bad checksum', () => {
    expect(() => stellarSeed('abandon '.repeat(12).trim())).toThrow('Invalid recovery phrase');
  });

  it('a different passphrase silently gives a different wallet', () => {
    const v = SEP5[3];
    expect(keypair(stellarSeed(v.mnemonic, 'wrong')).publicKey()).not.toBe(v.accounts[0][0]);
  });
});

describe('dice (SeedSigner-exact)', () => {
  for (const [rolls, words] of SEEDSIGNER_DICE) {
    it(`${rolls.length} rolls → ${words.split(' ').length} words`, () => {
      expect(rolls.length === 50 || rolls.length === 99).toBe(true);
      expect(toMnemonic(diceEntropy(rolls, rolls.length === 50 ? 12 : 24))).toBe(words);
    });
  }

  it('is reproducible', () => {
    const rolls = '3'.repeat(50);
    expect(diceEntropy(rolls, 12)).toEqual(diceEntropy(rolls, 12));
  });

  it('rejects wrong counts and non-dice digits', () => {
    expect(() => diceEntropy('1'.repeat(49), 12)).toThrow('exactly 50');
    expect(() => diceEntropy('1'.repeat(50), 24)).toThrow('exactly 99');
    expect(() => diceEntropy('0'.repeat(50), 12)).toThrow('1 to 6');
  });
});

describe('random and camera entropy', () => {
  it('make valid phrases of the right length', () => {
    expect(toMnemonic(randomEntropy(12)).split(' ')).toHaveLength(12);
    expect(toMnemonic(randomEntropy(24)).split(' ')).toHaveLength(24);
    const photos = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
    expect(isValidMnemonic(toMnemonic(cameraEntropy(photos, 24)))).toBe(true);
  });

  it('camera mixes in the phone, so the same photos never repeat a wallet', () => {
    const photos = [new Uint8Array(100), new Uint8Array(100)]; // two black photos
    expect(cameraEntropy(photos, 12)).not.toEqual(cameraEntropy(photos, 12));
    expect(() => cameraEntropy(photos.slice(1), 12)).toThrow('2 photos');
  });
});

describe('NFC shards', () => {
  const seed = stellarSeed(SEP5[0].mnemonic);
  const pin = 'correct horse';

  it('any 2 of 3 tags restore the wallet', async () => {
    const tags = await createShards(seed, pin);
    const opened = await Promise.all(tags.map((t) => openShard(t, pin)));
    for (const [a, b] of [[0, 1], [0, 2], [1, 2], [2, 0]]) {
      expect(keypair(await combineShards(opened[a], opened[b])).publicKey()).toBe(SEP5[0].accounts[0][0]);
    }
  });

  it('tags are small and look like random bytes', async () => {
    const tags = await createShards(seed, pin);
    const again = await createShards(seed, pin);
    for (const t of [...tags, ...again]) expect(t.length).toBe(SHARD_BYTES);
    expect(SHARD_BYTES).toBeLessThan(716);
    // no shared header or fingerprint: the same wallet backed up twice shares no prefix
    for (const t of tags) for (const u of again) expect(Buffer.from(t.subarray(0, 8)).equals(Buffer.from(u.subarray(0, 8)))).toBe(false);
    expect(Buffer.from(tags[0]).includes(Buffer.from('shard'))).toBe(false);
  });

  it('wrong PIN, tampering and garbage all fail the same way', async () => {
    const [tag] = await createShards(seed, pin);
    await expect(openShard(tag, 'wrong pin')).rejects.toThrow('Wrong PIN or not a backup tag');
    const tampered = tag.slice();
    tampered[60] ^= 1;
    await expect(openShard(tampered, pin)).rejects.toThrow('Wrong PIN or not a backup tag');
    await expect(openShard(new Uint8Array(SHARD_BYTES), pin)).rejects.toThrow('Wrong PIN or not a backup tag');
  });

  it('rejects the same tag twice and tags from different wallets', async () => {
    const mine = await Promise.all((await createShards(seed, pin)).map((t) => openShard(t, pin)));
    const other = await Promise.all((await createShards(stellarSeed(SEP5[1].mnemonic), pin)).map((t) => openShard(t, pin)));
    await expect(combineShards(mine[0], mine[0])).rejects.toThrow('same tag twice');
    await expect(combineShards(mine[0], other[1])).rejects.toThrow('different wallets');
    // writing new tags re-splits the same wallet: old + new must not silently give a wrong key
    const newer = await Promise.all((await createShards(seed, pin)).map((t) => openShard(t, pin)));
    await expect(combineShards(mine[0], newer[1])).rejects.toThrow('different backups');
    await expect(combineShards(mine[0], newer[0])).rejects.toThrow('older backup');
  });

  it('refuses short PINs', async () => {
    await expect(createShards(seed, '12345')).rejects.toThrow('at least 6');
  });
});

describe('scrypt', () => {
  it('OpenSSL (Node / quick-crypto) and @noble/hashes agree on our parameters', async () => {
    const salt = Uint8Array.from({ length: 16 }, (_, i) => i);
    const noble = await scryptAsync('123456', salt, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, dkLen: 32 });
    expect(await scrypt('123456', salt)).toEqual(noble);
  });
});
