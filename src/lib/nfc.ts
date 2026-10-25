import NfcManager, { Ndef, NfcTech, type NdefRecord } from 'react-native-nfc-manager';

// ponytail: emulators have no NFC, so there we fake in-memory tags to click flows through: every
// write lands on a fresh blank tag. Only the phone proves real tags work.
export const simulated: Promise<boolean> = NfcManager.isSupported().then((ok) => !ok, () => true);
export const simTags: number[][] = [];

simulated.then((sim) => {
  if (!sim) NfcManager.start().catch((e) => console.warn('NFC start failed:', e));
});

/** Holds an NDEF session open for one tap; always releases the radio. */
async function withNdef<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    return await fn();
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export const cancelTap = () => NfcManager.cancelTechnologyRequest().catch(() => {});

export async function writeRecords(records: NdefRecord[]): Promise<void> {
  const bytes = Ndef.encodeMessage(records) as number[];
  if (await simulated) {
    simTags.push(bytes);
    return;
  }
  return withNdef(() => NfcManager.ndefHandler.writeNdefMessage(bytes));
}

export async function readRecords(): Promise<{ id?: string; techTypes?: string[]; records: NdefRecord[] }> {
  if (await simulated) return { id: 'SIMULATED', techTypes: ['simulated'], records: simTags.length ? Ndef.decodeMessage(simTags.at(-1)!) : [] };
  return withNdef(async () => {
    const tag = await NfcManager.getTag();
    return { id: tag?.id, techTypes: tag?.techTypes, records: tag?.ndefMessage ?? [] };
  });
}

export const textOf = (r: NdefRecord) => Ndef.text.decodePayload(Uint8Array.from(r.payload));

/** Shown to the user as-is. `code` lets the screen react (e.g. offer to overwrite). */
export class TagError extends Error {
  constructor(public code: 'used' | 'hasData' | 'mismatch', message: string) {
    super(message);
  }
}

const sameBytes = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * One tap: refuses a tag listed in `usedIds` or (unless `overwrite`) one that already holds data,
 * writes `payload` as a single generic MIME record, then reads the tag back and compares bytes.
 * Returns the tag id.
 */
export async function writeVerified(payload: Uint8Array, usedIds: string[], overwrite: boolean): Promise<string> {
  // application/octet-stream: says nothing about what the bytes are or which app wrote them
  const bytes = Ndef.encodeMessage([Ndef.record(Ndef.TNF_MIME_MEDIA, 'application/octet-stream', [], Array.from(payload))]) as number[];
  if (await simulated) {
    simTags.push(bytes);
    return `SIM-${simTags.length}`;
  }
  return withNdef(async () => {
    const tag = await NfcManager.getTag();
    const id = tag?.id ?? '';
    if (usedIds.includes(id)) throw new TagError('used', 'You already used this tag. Take a new one.');
    if (!overwrite && tag?.ndefMessage?.length) throw new TagError('hasData', 'This tag already has something on it.');
    await NfcManager.ndefHandler.writeNdefMessage(bytes, { reconnectAfterWrite: true });
    const back = (await NfcManager.ndefHandler.getNdefMessage())?.ndefMessage ?? [];
    if (!sameBytes(Ndef.encodeMessage(back) as number[], bytes)) {
      throw new TagError('mismatch', 'The tag didn’t keep the data. Try again, or use another tag.');
    }
    return id;
  });
}
