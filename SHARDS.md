# Kintsu: wallet creation, backups and NFC recovery

Source of truth for the crypto in `packages/crypto`. Every rule here has a test in `packages/crypto/crypto.test.ts`.

## Rules
- Recovery phrases and secret keys are only ever written **by hand on paper**. No clipboard, no paste, no password managers, no screenshots, no network.
- Every backup method is enough on its own; users may pick several (tags + paper phrase, etc.).
- Only audited, widely used libraries: `@scure/bip39`, `@noble/hashes`, `@noble/ciphers`, `shamir-secret-sharing`, and OpenSSL's scrypt via `react-native-quick-crypto` (pure-JS scrypt took ~2 min per tag on Hermes), pinned to exact versions. Our own glue is pinned by official test vectors.

## Creating a wallet
User picks the phrase length (12 or 24 words), then the randomness source:

| Source | Entropy | Reproducible |
|---|---|---|
| Random | `crypto.getRandomValues` (Android `SecureRandom`), 16 or 32 bytes | no |
| Dice | **SeedSigner-exact**: `SHA-256(rolls as typed "1".."6")`, first 16 bytes for 12 words (50 rolls), all 32 for 24 words (99 rolls). Never mixed. | yes: same rolls → same words on SeedSigner or `echo -n <rolls> \| sha256sum` |
| Camera | `h = SHA-256(32 random bytes)`, then `h = SHA-256(h ‖ photo)` for each of 2 photos, truncated. Weak photos (dark, uniform, near-duplicate) are rejected in the UI and retaken. | no (like SeedSigner) |

Entropy → BIP39 words (`@scure/bip39`, English) → optional passphrase → **SEP-0005** key: BIP39 seed, then SLIP-10 ed25519 at `m/44'/148'/0'` → 32-byte ed25519 seed → `Keypair.fromRawEd25519Seed`.

- Words → wallet works (import). Wallet (S… key) → words does not: derivation is one-way, and encoding a raw key as words would not be a standard phrase other wallets understand. Wallets imported from an S… key back up with tags or the S… key on paper.
- A wrong passphrase silently opens a different, empty wallet. The UI says so.
- Creating a phrase: shown once (airplane mode on), then the user picks 3 random words from 4 options each.

## Hardware
- Tags: **MIFARE Classic 1K** (NDEF-formatted, 716 B free, writable, can't be locked). Its own crypto (Crypto-1) is broken; treat the tag as plain memory. All security comes from our encryption.
- Android with an NXP NFC chip reads/writes it. **iOS can't read MIFARE Classic**, so this is Android-only.
- `react-native-nfc-manager` (Android development build), `NfcTech.Ndef`.

## NFC shards
The 32-byte ed25519 seed is split 2-of-3 (`shamir-secret-sharing`, GF(256)), so **any wallet can be exported to tags**, created or imported.

Each tag gets one NDEF record (MIME `application/octet-stream`) holding 95 bytes:
```
salt(16) ‖ nonce(24) ‖ XChaCha20-Poly1305_k( v(1)=1 ‖ idx(1) 0..2 ‖ fp(4) ‖ share(33) )   // +16 tag
k  = scrypt(NFKC(pin), salt, N=2^15, r=8, p=1, dkLen=32)   # OpenSSL; tests check it equals @noble/hashes
fp = SHA-256(ed25519 public key)[0..4]
```
- **No clues**: version, index, 2-of-3 and the wallet fingerprint are inside the ciphertext. Each tag has its own salt and nonce, so a tag is indistinguishable from random bytes, and two tags can't be linked without the PIN. No app URI, no labels on the physical tags.
- Cost of that: tapping a tag doesn't open the app, and restore runs scrypt once per tag (~1 s each).
- Wrong PIN, tampering and "not one of our tags" give the same error.

## Flows
**Back up (during create/import, or Settings → Add a backup)**
1. Explain: "Any 2 of these 3 tags plus your PIN bring your wallet back. Keep them in different places."
2. PIN/passphrase, min 6 characters; warn that someone holding two tags can brute-force a short PIN.
3. For each tag: "Hold tag N" → write → read back → compare bytes → ✅. The next tag's wait starts on its own; a tag that already holds data is overwritten.
4. Recommended, skippable test: tap each tag again in any order. Each must be one of the 3 just written and open with the PIN, then every pair must rebuild the seed. Catches one tag written over three times.
5. A tag already used in this run is waited out (it's usually still on the phone). Store the date locally; show it on Home.
6. Writing new tags makes a new split: old and new tags don't combine (restore says they're from different backups), so retire the old set.

**Restore (first launch → Restore from tags)**
1. Enter PIN. 2. Tap any tag, decrypt it; tap a second, decrypt it. 3. Reject the same tag twice and tags from different wallets. 4. Combine → seed → check `fp`. 5. Store in SecureStore and open Home.

**Rotate / wipe**: "Overwrite tags" re-runs backup; "Erase tag" writes an empty NDEF message.

## Keys, weights and protection
- **Recovery key** = the wallet's own key (phrase, paper S… key, tags); the G… address is always its. **Phone key** = random, only in this phone's SecureStore. **Second factors** = the YubiKey (OpenPGP Ed25519 key, over NFC). Only the YubiKey for now.
- **Simple by default:** after creating/importing/restoring, the phone holds the recovery key and can do everything, like a normal wallet. Nothing happens on-chain on its own.
- **Protect (optional, Home → Unprotected card or Settings):** one recovery-signed transaction adds a phone key (and optionally the YubiKey), then the recovery key is deleted from the phone. No tags needed, since the phone still holds the recovery key. Needs a backup first and enough XLM for the reserves: (2 + 1 + factors) × 0.5 XLM (`protectionMinimum`).
- Weights double as roles (`src/lib/chain.ts`): recovery 5, phone 2, second factor 1. Thresholds: low 1, medium 2 without 2FA / 3 with it, high 5.
  - Sending: phone alone (2) without 2FA; with 2FA phone + one factor (3). Factors without the phone (1 + 1) never reach 3.
  - Changing keys: only the recovery key; phone + every factor is 4 < 5. On a protected phone that means 2 tags + PIN (add a YubiKey, turn 2FA off).
- `configure(recovery, phone, factors)` sets exactly that state and removes every other signer.
- **Restore of a protected wallet** re-protects at once (`keepProtection` on Home): the old phone (weight 2) is removed, factors (weight 1) kept.
- **Adding a backup on a protected phone:** 2 tags + PIN (or the paper, typed offline) bring the recovery key back in memory for that one backup; the phone keeps only its own key. The 12/24 words can't be re-made from the key, so new backups are tags or the S… key.

## Home, tokens, history
- Tabs: Home, Activity, Swap, Settings. Home: "Not backed up" while there's no backup, "Unprotected" while an unprotected wallet holds funds, balance with Send/Receive/Add token/Test XLM, TOKENS. Settings shows Protected/Unprotected.
- Tokens = code + issuer; only Circle's USDC and EURC (issuers checked against Circle's docs) are offered. Adding one is a trustline (0.5 XLM reserve) and is approved like a payment (phone, + YubiKey with 2FA). Tokens only go to accounts that added them.
- History reads Horizon (RPC has no per-account history); rows open stellar.expert.

## Swap and prices
- Swap tab: a path payment to yourself on Stellar's exchange (Horizon finds the route), sell exactly X, fail if the result is >1% under the quote. Pay with anything held; get XLM or a checked token (not "top by volume": look-alike tokens dominate those lists). Getting a token you don't hold adds it in the same transaction.
- Totals price every network's balances at mainnet rates (testnet's are made up), USD via USDC, EUR via EURC; a market that loses >5% on a round trip is too thin and isn't counted.

## Networks
- Same address on testnet and mainnet (it's just the public key), separate balance and on-chain keys on each. Testnet by default; Settings switches. A protected phone stays on the network it's protected on.
- Same behaviour on both: a new wallet is empty until its first deposit opens the account. Testnet adds a "Get 10,000 test XLM" button (Friendbot) instead of opening it silently.
- RPC: SDF's testnet RPC; mainnet via Gateway's free public RPC (SDF runs none).

## YubiKey
- Only the OpenPGP app's signing slot is used; FIDO (security-key logins), OTP, PIV and OATH are separate apps the commands can't reach.
- Setup creates an Ed25519 key only in an empty slot, reuses an existing Ed25519 key, refuses any other key, records the fingerprint so gpg sees the slot as taken, and never spends the last PIN try.

## Tests
- Unit (`npm test`): SEP-0005 vectors 1–5 incl. passphrase; SeedSigner dice vectors (50 and 99 rolls); random/camera lengths and camera never repeating; any 2 of 3 restore; wrong PIN, tamper and garbage fail; same tag twice and mixed wallets rejected; short PIN rejected; 95 bytes < 716; no shared prefix across backups.
- Manual: back up → clear app data → restore with tags 1 + 3 → same G-address.

## Security notes for the README
- One stolen tag reveals nothing and doesn't even say what it is. Two tags + PIN = full control, so recommend a passphrase-length PIN.
- Tags are cloneable; irrelevant for secrecy, but a clone is as good as the original to whoever knows the PIN.
- Secrets pass through app memory only during create/backup/restore; never logged, never sent anywhere.
- Scope: 2-of-3 on MIFARE Classic, Android. Later: NTAG216 for iOS.
