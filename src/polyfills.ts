// Must load before @stellar/stellar-sdk. Kept in its own module because
// ES imports are hoisted: inlined in the entry, the SDK could evaluate first.
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

globalThis.Buffer = globalThis.Buffer ?? Buffer;
