import NfcManager, { Ndef, NfcTech, type NdefRecord } from 'react-native-nfc-manager';

// ponytail: emulators have no NFC, so there we fake a single in-memory tag to click flows through.
// Only the phone proves real tags work.
export const simulated: Promise<boolean> = NfcManager.isSupported().then((ok) => !ok, () => true);
let simTag: number[] = [];

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
    simTag = bytes;
    return;
  }
  return withNdef(() => NfcManager.ndefHandler.writeNdefMessage(bytes));
}

export async function readRecords(): Promise<{ id?: string; techTypes?: string[]; records: NdefRecord[] }> {
  if (await simulated) return { id: 'SIMULATED', techTypes: ['simulated'], records: simTag.length ? Ndef.decodeMessage(simTag) : [] };
  return withNdef(async () => {
    const tag = await NfcManager.getTag();
    return { id: tag?.id, techTypes: tag?.techTypes, records: tag?.ndefMessage ?? [] };
  });
}

export const textOf = (r: NdefRecord) => Ndef.text.decodePayload(Uint8Array.from(r.payload));
