# Kintsu

A paperless Stellar wallet for Android. No seed phrase to store: the backup is three NFC tags, and spending can require a 2FA device, an offline key you tap against the phone.

Any 2 of the 3 tags plus your PIN bring the wallet back. One tag alone is random-looking bytes: it doesn't say it's a wallet, whose it is, or which piece it holds. Once the wallet is protected, the phone can't move money on its own: every payment also needs a tap of your 2FA device, and changing who controls the account needs 2 tags + PIN. You can still write the words on paper as a second backup, for peace of mind.

Built at HackMeridian 2026 Lisbon (Genesis path, Stellar Composed + Stellar Unlocked).

[Pitch deck (PDF)](docs/kintsu-deck.pdf) · [Android APK](../../releases/latest)

## Why

People lose crypto in two ways: they get hacked, or they lose their keys.

**Hacks.** AI is getting very good at finding bugs. Assume anything online will be hacked, including your phone.
- **Your keys should come from you.** In July, a random number bug in Coldcard firmware let attackers drain thousands of Bitcoin wallets. People who had rolled their own dice were safe. ([news](https://thehackernews.com/2026/08/coldcard-hardware-wallet-flaw-linked-to.html)) Kintsu creates the wallet from your dice rolls or your photos.
- **One device shouldn't be able to spend everything.** In Kintsu, a payment needs the phone and a tap of an offline 2FA device.

**Lost keys.** Seed phrases get lost, thrown away, or photographed into the cloud. Kintsu has no phrase to keep: 3 tags in 3 places, and any 2 bring the wallet back. Lose the phone, or one tag, and nothing is lost.

## What it does

**Create or bring back a wallet**
- New wallet with 12 or 24 words, from the phone's randomness, your own dice rolls, or 2 photos mixed with the phone's randomness.
- Import a recovery phrase or a secret key, or restore from 2 tags + PIN.
- Keys follow SEP-0005, so the phrase also works in other Stellar wallets.

**Back up**
- 3 NFC tags + PIN (default, recommended), the phrase on paper, or the secret key on paper. Pick one or more.
- Each tag is written, read back and compared byte by byte. At the end you can tap each tag again: the app rebuilds the key from every pair, exactly as a restore would, so you know any 2 of the 3 work. You can skip that if you're in a hurry.

**Protect (optional)**
- One transaction turns the account into a 2-of-device setup: a new phone key, an optional 2FA device, and the recovery key removed from the phone.
- With 2FA on, every payment, swap and new token needs a tap of the 2FA device. It's offline hardware with its own key that never leaves it. Today that's a YubiKey 5 NFC (its OpenPGP Ed25519 key, over NFC).
- Home shows a red "Unprotected" card whenever an unprotected wallet holds funds.

**Use it**
- Send, receive (QR), activity history, swap on Stellar's DEX, add USDC/EURC, totals in USD/EUR/XLM.
- Testnet by default with a "Test XLM" button (Friendbot). Mainnet in Settings.

## How it works

**Tags.** The 32-byte ed25519 seed is split 2-of-3 with Shamir secret sharing. Each tag holds 95 bytes:

```
salt(16) ‖ nonce(24) ‖ XChaCha20-Poly1305( version ‖ index ‖ wallet fingerprint ‖ share )
key = scrypt(PIN, salt, N=2^15, r=8, p=1)
```

Version, index and fingerprint are inside the ciphertext, and every tag has its own salt and nonce, so two tags can't be linked to each other without the PIN. Wrong PIN, a tampered tag and a stranger's tag all give the same error. Tags are MIFARE Classic 1K; their built-in crypto is broken, so the app treats them as plain memory and all the security comes from the encryption.

**Who can do what** (Stellar account signers and thresholds):

| Signer | Weight | Lives in |
|---|---|---|
| Recovery key | 5 | Tags / paper. Not on the phone once protected |
| Phone key | 2 | Phone's secure storage |
| 2FA device | 1 | The device itself (never leaves it) |

Thresholds: low 1, medium 3 with 2FA (2 without), high 5.
- Paying: phone + 2FA device = 3. A stolen phone alone (2) can't. The 2FA device alone (1) can't.
- Changing signers: only the recovery key (5), so a lost phone or 2FA device is replaced with 2 tags + PIN.

**Libraries.** Only audited, widely used crypto, pinned to exact versions: `@scure/bip39`, `@noble/hashes`, `@noble/ciphers`, `shamir-secret-sharing`, OpenSSL scrypt via `react-native-quick-crypto`, and `@stellar/stellar-sdk`. The glue is tested against official vectors.

Full spec: [SHARDS.md](SHARDS.md).

## Stellar features used

- Account multisig: signer weights and low/medium/high thresholds (`setOptions`), changed in one transaction
- SEP-0005 key derivation
- Path payments on the built-in DEX for swaps (`pathPaymentStrictSend` to yourself, 1% slippage cap)
- Trustlines for USDC and EURC (Circle's issuers)
- DEX order books for pricing (USD via USDC, EUR via EURC)
- Horizon for history, Stellar RPC, Friendbot on testnet

## Try it

You need an Android phone with NFC, 3 MIFARE Classic 1K tags (NDEF-formatted), and optionally a 2FA device (YubiKey 5 NFC). On a phone or emulator **without NFC**, the app simulates the tags and the 2FA device, so every flow can still be clicked through.

Install the APK from the [latest release](../../releases/latest), or build it:

```sh
npm install
npx expo run:android      # development build on a connected device or emulator
npm test                  # crypto and app unit tests
TESTNET=1 npx vitest run  # also runs the tests that hit Stellar testnet
```

A 3-minute path: Create wallet → Random, 12 words → write the words down and pick 3 back → NFC tags → PIN → tap 3 tags (then tap each again for the test) → Home → Test XLM → Protect with 2FA → Send (tap the 2FA device).

## Limits

- Android only for now. iPhone support is next, after the hackathon: iPhones can't read the MIFARE Classic tags used here, so it needs a different tag (NTAG216).
- Two tags + PIN give full control, so a short PIN can be brute-forced by someone holding two tags. The app asks for at least 6 characters and recommends longer.
- YubiKey is the only supported 2FA device for now.
- Beta. Use small amounts on mainnet.
