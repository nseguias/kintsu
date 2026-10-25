import { cameraEntropy, diceEntropy, DICE_ROLLS, randomEntropy, type Words } from '@crypto/entropy';
import { toMnemonic } from '@crypto/mnemonic';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Choice, Screen, Segmented, s } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { startDraft } from '@/lib/draft';

type Source = 'random' | 'dice' | 'camera';

// ponytail: "weak photo" = JPEG compresses to under this many bytes per pixel (lens cap, blank wall).
// Calibration knob: tune on the real phone; the phone's randomness is always mixed in anyway.
const WEAK_BYTES_PER_PIXEL = 0.08;

export default function Create() {
  const router = useRouter();
  const [words, setWords] = useState<Words>(12);
  const [source, setSource] = useState<Source>('random');
  const [rolls, setRolls] = useState('');
  const [photos, setPhotos] = useState<Uint8Array[]>([]);
  const [error, setError] = useState('');

  const need = DICE_ROLLS[words];
  const ready = source === 'random' || (source === 'dice' && rolls.length === need) || (source === 'camera' && photos.length === 2);

  const create = () => {
    const entropy =
      source === 'dice' ? diceEntropy(rolls, words) : source === 'camera' ? cameraEntropy(photos, words) : randomEntropy(words);
    startDraft({ mnemonic: toMnemonic(entropy), imported: false });
    router.push('/backup');
  };

  return (
    <Screen>
      <Text style={s.label}>PHRASE LENGTH</Text>
      <Segmented
        options={[{ label: '12 words', value: 12 }, { label: '24 words', value: 24 }]}
        value={words}
        onChange={(w) => {
          setWords(w);
          setRolls((r) => r.slice(0, DICE_ROLLS[w]));
        }}
      />

      <Text style={s.label}>RANDOMNESS FROM</Text>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <Choice style={{ flex: 1, padding: Spacing.md }} title="Random" body="Phone" selected={source === 'random'} onPress={() => setSource('random')} />
        <Choice style={{ flex: 1, padding: Spacing.md }} title="Dice" body={`${need} rolls`} selected={source === 'dice'} onPress={() => setSource('dice')} />
        <Choice style={{ flex: 1, padding: Spacing.md }} title="Camera" body="2 photos" selected={source === 'camera'} onPress={() => setSource('camera')} />
      </View>

      {source === 'random' && (
        <Text style={Type.small}>Your phone’s secure random generator makes {words === 12 ? 128 : 256} bits of randomness.</Text>
      )}
      {source === 'dice' && <Dice rolls={rolls} need={need} onChange={setRolls} />}
      {source === 'camera' && <Photos photos={photos} onChange={setPhotos} onError={setError} />}

      {!!error && <Text style={[Type.small, { color: Colors.negative }]}>{error}</Text>}
      <View style={{ flex: 1 }} />
      <Button
        title={source === 'dice' && !ready ? `${need - rolls.length} more rolls` : `Create ${words}-word wallet`}
        disabled={!ready}
        onPress={create}
      />
    </Screen>
  );
}

function Dice({ rolls, need, onChange }: { rolls: string; need: number; onChange: (r: string) => void }) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={Type.heading}>Roll a real die, tap what you see</Text>
        <Text style={[Type.num, { fontSize: 20 }]}>{rolls.length} / {need}</Text>
      </View>
      <Text style={Type.small}>Same rolls, same words, as on SeedSigner.</Text>
      <View style={{ height: 8, backgroundColor: Colors.neutralChip, borderRadius: Radius.full, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${(rolls.length / need) * 100}%`, backgroundColor: Colors.primary }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {['1', '2', '3', '4', '5', '6'].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Rolled ${n}`}
            disabled={rolls.length >= need}
            onPress={() => onChange(rolls + n)}
            style={[s.card, { flex: 1, padding: 0, height: 52, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[Type.num, { fontSize: 24 }]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[Type.small, { fontFamily: 'monospace' }]}>{rolls.slice(-20).replace(/(.{5})/g, '$1 ')}</Text>
        <Button kind="link" title="Undo last" disabled={!rolls} onPress={() => onChange(rolls.slice(0, -1))} />
      </View>
    </View>
  );
}

function Photos({ photos, onChange, onError }: { photos: Uint8Array[]; onChange: (p: Uint8Array[]) => void; onError: (e: string) => void }) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  if (!permission?.granted) {
    return <Button kind="secondary" title="Allow camera" onPress={requestPermission} />;
  }

  const shoot = async () => {
    setBusy(true);
    onError('');
    try {
      const pic = await camera.current!.takePictureAsync({ quality: 1, shutterSound: false });
      const file = new File(pic.uri);
      const bytes = await file.bytes();
      file.delete(); // never kept on disk
      if (bytes.length / (pic.width * pic.height) < WEAK_BYTES_PER_PIXEL) {
        return onError('That photo is too dark or plain. Point at something detailed and try again.');
      }
      if (photos.some((p) => p.length === bytes.length && p.every((b, i) => b === bytes[i]))) {
        return onError('That looks like the same photo. Take a different one.');
      }
      onChange([...photos, bytes]);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      {photos.length < 2 && <CameraView ref={camera} style={{ height: 260, borderRadius: Radius.lg }} facing="back" animateShutter={false} />}
      <Text style={Type.heading}>{photos.length === 2 ? 'Both photos mixed in' : `Photo ${photos.length + 1} of 2`}</Text>
      <Text style={Type.small}>Each photo is mixed with the phone’s randomness, then discarded. Never saved, never uploaded.</Text>
      {photos.length < 2 ? (
        <Button kind="secondary" title={busy ? 'Taking photo…' : `Take photo ${photos.length + 1}`} disabled={busy} onPress={shoot} />
      ) : (
        <Button kind="link" title="Start over" onPress={() => onChange([])} />
      )}
    </View>
  );
}
