import NfcManager, { Ndef, NfcTech, type NdefRecord } from 'react-native-nfc-manager';

NfcManager.start().catch((e) => console.warn('NFC start failed:', e));

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

export function writeRecords(records: NdefRecord[]): Promise<void> {
  return withNdef(async () => {
    await NfcManager.ndefHandler.writeNdefMessage(Ndef.encodeMessage(records) as number[]);
  });
}

export function readRecords(): Promise<{ id?: string; techTypes?: string[]; records: NdefRecord[] }> {
  return withNdef(async () => {
    const tag = await NfcManager.getTag();
    return { id: tag?.id, techTypes: tag?.techTypes, records: tag?.ndefMessage ?? [] };
  });
}

export const textOf = (r: NdefRecord) => Ndef.text.decodePayload(Uint8Array.from(r.payload));
