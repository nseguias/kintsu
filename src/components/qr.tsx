import QRCode from 'qrcode';
import React, { useMemo } from 'react';
import { PixelRatio, View } from 'react-native';

/** A QR code drawn with plain Views: one row per module line, dark runs merged into single Views. */
export function QrCode({ value, size }: { value: string; size: number }) {
  const rows = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const n = modules.size;
    return Array.from({ length: n }, (_, y) => {
      const runs: { x: number; w: number }[] = [];
      for (let x = 0; x < n; x++) {
        if (!modules.get(y, x)) continue;
        if (runs.length && runs[runs.length - 1].x + runs[runs.length - 1].w === x) runs[runs.length - 1].w++;
        else runs.push({ x, w: 1 });
      }
      return runs;
    });
  }, [value]);

  // whole device pixels per module, or rows show hairline gaps; 4-module quiet zone on each side
  const px = Math.max(1, Math.floor(PixelRatio.getPixelSizeForLayoutSize(size) / (rows.length + 8)));
  const cell = px / PixelRatio.get();
  return (
    <View style={{ width: cell * (rows.length + 8), height: cell * (rows.length + 8), backgroundColor: '#fff', padding: cell * 4 }}>
      {rows.map((runs, y) => (
        <View key={y} style={{ height: cell, flexDirection: 'row' }}>
          {runs.map((r) => (
            <View key={r.x} style={{ position: 'absolute', left: r.x * cell, width: r.w * cell, height: cell, backgroundColor: '#000' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
