import NfcManager, { Ndef, NfcTech, type NdefRecord } from 'react-native-nfc-manager';

// ponytail: emulators have no NFC, so there we fake in-memory tags to click flows through: every
// write lands on a fresh blank tag. Only the phone proves real tags work.
export const simulated: Promise<boolean> = NfcManager.isSupported().then((ok) => !ok, () => true);
const simTags: number[][] = [];
let simReads = 0; // each simulated read taps the next fake tag, round-robin

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

async function readRecords(): Promise<{ id?: string; techTypes?: string[]; records: NdefRecord[] }> {
  if (await simulated) {
    if (!simTags.length) return { id: 'SIM-0', techTypes: ['simulated'], records: [] };
    const i = simReads++ % simTags.length;
    return { id: `SIM-${i + 1}`, techTypes: ['simulated'], records: Ndef.decodeMessage(simTags[i]) };
  }
  return withNdef(async () => {
    const tag = await NfcManager.getTag();
    return { id: tag?.id, techTypes: tag?.techTypes, records: tag?.ndefMessage ?? [] };
  });
}

/** Shown to the user as-is. */
export class TagError extends Error {
  constructor(public code: 'used' | 'mismatch', message: string) {
    super(message);
  }
}

const MIME = 'application/octet-stream';
const sameBytes = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.from(a).every((x, i) => x === b[i]);
// Android may hand back `type` as bytes or as a string; isType copes with both
const isShard = (r: NdefRecord) => Ndef.isType(r, Ndef.TNF_MIME_MEDIA, MIME);

/**
 * One tap: refuses a tag listed in `usedIds`, overwrites whatever else the tag holds, writes `payload` as a single generic MIME record, then reads the tag back and compares bytes.
 * Returns the tag id.
 */
export async function writeVerified(payload: Uint8Array, usedIds: string[]): Promise<string> {
  // application/octet-stream: says nothing about what the bytes are or which app wrote them
  const bytes = Ndef.encodeMessage([Ndef.record(Ndef.TNF_MIME_MEDIA, MIME, [], Array.from(payload))]) as number[];
  if (await simulated) {
    simTags.push(bytes);
    return `SIM-${simTags.length}`;
  }
  return withNdef(async () => {
    const tag = await NfcManager.getTag();
    const id = tag?.id ?? '';
    if (usedIds.includes(id)) throw new TagError('used', 'You already used this tag. Take a new one.');
    await NfcManager.ndefHandler.writeNdefMessage(bytes, { reconnectAfterWrite: true });
    const back = (await NfcManager.ndefHandler.getNdefMessage())?.ndefMessage ?? [];
    if (back.length !== 1 || !isShard(back[0]) || !sameBytes(back[0].payload, payload)) {
      throw new TagError('mismatch', 'The tag didn’t keep the data. Try again, or use another tag.');
    }
    return id;
  });
}

/** One tap: returns the backup bytes on the tag. Whether they're really ours only the PIN can tell. */
export async function readShardBytes(): Promise<{ id: string; bytes: Uint8Array }> {
  const { id, records } = await readRecords();
  const r = records.find(isShard);
  if (!r) throw new Error(records.length ? 'This tag isn’t one of your backup tags.' : 'This tag is empty.');
  return { id: id ?? '', bytes: Uint8Array.from(r.payload) };
}
