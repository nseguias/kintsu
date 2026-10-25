# Addendum: NFC recovery shards (build only after HACKATHON_SPEC §9 steps 1–7 are green)

Answers the "no key recovery in v1" gap with 2-of-3 Shamir shards on NFC tags.

## Hardware facts
- Tags available: **MIFARE Classic 1K** (ISO 14443-3A, NDEF-formatted, 716 B free, writable, cannot be locked). Its own crypto (Crypto-1) is broken; treat the tag as plain memory. All security comes from our encryption.
- Android with an NXP NFC chip reads/writes it (the dev phone does). **iOS cannot read MIFARE Classic** → this feature is Android-only for the demo; state it in the README.
- Library: `react-native-nfc-manager` (not in Expo Go → Android development build). Use the `Ndef` tech: `NfcManager.requestTechnology(NfcTech.Ndef)`, `Ndef.writeNdefMessage`, `NfcManager.getTag()` / `ndefMessage` to read.

## Crypto
- Secret: the 32-byte ed25519 seed (`Keypair.rawSecretKey()`).
- Split: `shamir-secret-sharing` (GF(256), audited, pure JS): `split(seed, 3, 2)` → three 33-byte shares. Restore: `combine([a, b])`.
- Per-share encryption: `key = scrypt(pin, salt, { N: 2**15, r: 8, p: 1, dkLen: 32 })` (`@noble/hashes/scrypt`; ~1 s on a phone), then `xchacha20poly1305(key).encrypt(nonce, share, aad)` from `@noble/ciphers`, with `aad = "diablo-shard-v1" || idx || fp`.
- Same `salt` and `pin` for all three shards (user sets one PIN/passphrase); different `nonce` per shard.

## Tag payload (one NDEF URI record, so a tap deep-links into the app)
`diablo://shard#<base64url(bytes)>` where bytes =
```
v(1)=1 | idx(1) 0..2 | k(1)=2 | n(1)=3 | fp(4)=sha256(pubkey)[0..4] | salt(16) | nonce(24) | ct(33+16)
```
≈ 97 bytes raw, ≈ 130 chars base64url. Fits with room to spare.

## App flows
**Back up (Profile → "Back up wallet to tags")**
1. Explain: "You'll need any 2 of the 3 tags plus your PIN to recover. Keep them in different places."
2. Set PIN/passphrase (min 6 chars; warn that short PINs can be brute-forced by someone holding two tags).
3. For idx in 0..2: "Tap tag N" → write → read back → compare bytes → ✅. Abort cleanly if a tag already holds a shard for a different `fp` (ask to overwrite).
4. Mark `backedUp = true` in local settings; show date in Profile.

**Restore (Onboarding → "Restore from tags")**
1. Enter PIN. 2. "Tap any shard tag" ×2: parse, check `v`, require both `fp` equal, reject duplicate `idx`. 3. Decrypt both (wrong PIN → AEAD failure → "Wrong PIN"). 4. `combine` → seed → derive keypair → assert `sha256(pubkey)[0..4] == fp`. 5. Store in SecureStore, continue to Home with existing balances loaded from chain.

**Rotate / wipe**: "Overwrite tags" re-runs backup; "Erase tag" writes an empty NDEF message.

## Tests
- Unit: split/combine round-trip; any 2 of 3 restore, 1 does not; wrong PIN fails; tampered byte fails AEAD; fp mismatch rejected; payload size < 716 B.
- Manual: back up → clear app data → restore with tags 1+3 → same G-address.

## Security notes for the README
- A stolen tag alone reveals nothing (ciphertext). Two tags + PIN = full control, so the PIN matters; recommend a passphrase.
- Tags are cloneable; irrelevant because the payload is encrypted, but a cloned tag is as good as the original to whoever knows the PIN.
- The seed passes through app memory during backup/restore only; never logged, never sent anywhere.
- Demo scope: 2-of-3 on MIFARE Classic, Android. Production: NTAG216 (iOS-compatible), optional cloud-encrypted third shard.
