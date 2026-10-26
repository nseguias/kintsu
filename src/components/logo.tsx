import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Polygon, Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/*
 * The Kintsu mark: a wallet cut into three equal shards (one per NFC tag). They come together
 * bottom-up, the flap lands last, gold fills the cracks (kintsugi) and a gold seal locks it on
 * the flap's tip. Drawn in a 200×200 box; each piece is its own layer so the motion runs on the
 * native driver. `once` plays the assembly a single time and stays put (for Home).
 */
const LOOP = 4800;
const ASSEMBLED = 0.6; // a point in the loop where everything is in place (reduced motion)
const SEAL = { x: 100, y: 94.7 };
// the two cracks, along the middle of the gaps between shards
const SEAMS = 'M20,86.7 L36,86.7 L100,94.7 L164,86.7 L180,86.7 M20,119.3 L36,119.3 L100,127.3 L164,119.3 L180,119.3';

const SHARDS = [
  { fill: '#3A6B5C', points: '20,121.8 36,121.8 100,129.8 164,121.8 180,121.8 180,180 20,180', nfc: 133.4,
    at: [0, 0.06, 0.2, 0.24, 0.84, 0.96, 1], y: [30, 30, -3, 0, 0, 30, 30] },
  { fill: '#2F5E55', points: '20,89.2 36,89.2 100,97.2 164,89.2 180,89.2 180,116.8 164,116.8 100,124.8 36,116.8 20,116.8', nfc: 99,
    at: [0, 0.1, 0.26, 0.3, 0.84, 0.94, 1], y: [-6, -6, 2, 0, 0, -6, -6] },
  { fill: Colors.primary, points: '20,40 180,40 180,84.2 164,84.2 100,92.2 36,84.2 20,84.2', nfc: 65.6,
    at: [0, 0.14, 0.34, 0.37, 0.4, 0.84, 0.92, 1], y: [-34, -34, 2, -2, 0, 0, -34, -34] },
];

/** NFC glyph (dot + three arcs), 14 units wide, top-left at (x, y). */
const Body = ({ id }: { id: string }) => (
  <Defs>
    <ClipPath id={id}>
      <Rect x={36} y={58} width={128} height={98} rx={18} />
    </ClipPath>
  </Defs>
);

const Nfc = ({ x, y }: { x: number; y: number }) => (
  <G transform={`translate(${x + 7} ${y + 7}) scale(${14 / 22})`} opacity={0.85}>
    <Circle cx={-8} cy={0} r={1.2} fill={Colors.background} />
    <Path d="M-5.17 -2.83 A4 4 0 0 1 -5.17 2.83 M-2.34 -5.66 A8 8 0 0 1 -2.34 5.66 M0.49 -8.49 A12 12 0 0 1 0.49 8.49" fill="none" stroke={Colors.background} strokeWidth={2.2} strokeLinecap="round" />
  </G>
);

/**
 * The native driver can't ease inside `interpolate`, so each keyframe segment is pre-sampled
 * along an ease-in-out curve (8 steps is smooth at these sizes).
 */
const ease = Easing.inOut(Easing.ease);
function eased(inputRange: number[], outputRange: number[]) {
  const input = [inputRange[0]];
  const output = [outputRange[0]];
  for (let i = 1; i < inputRange.length; i++) {
    for (let k = 1; k <= 8; k++) {
      input.push(inputRange[i - 1] + ((inputRange[i] - inputRange[i - 1]) * k) / 8);
      output.push(outputRange[i - 1] + (outputRange[i] - outputRange[i - 1]) * ease(k / 8));
    }
  }
  return { inputRange: input, outputRange: output };
}

export function Logo({ size = 96, once }: { size?: number; once?: boolean }) {
  const t = useRef(new Animated.Value(ASSEMBLED)).current;
  useEffect(() => {
    const play = (to: number) => Animated.timing(t, { toValue: to, duration: LOOP * to, easing: Easing.linear, useNativeDriver: true });
    const loop = once ? play(ASSEMBLED) : Animated.loop(play(1));
    AccessibilityInfo.isReduceMotionEnabled().then((calm) => {
      if (calm) return;
      t.setValue(0);
      loop.start();
    });
    return () => loop.stop();
  }, [t, once]);

  const unit = size / 200;
  const at = (inputRange: number[], outputRange: number[]) => t.interpolate(eased(inputRange, outputRange));
  const layer = { position: 'absolute' as const, width: size, height: size };
  const sealBox = (r: number) => ({ position: 'absolute' as const, left: (SEAL.x - r) * unit, top: (SEAL.y - r) * unit, width: 2 * r * unit, height: 2 * r * unit, borderRadius: r * unit });

  return (
    <View accessibilityRole="image" accessibilityLabel="Kintsu" style={{ width: size, height: size }}>
      <Animated.View
        style={[sealBox(10), { borderWidth: 2 * unit, borderColor: Colors.gold },
          { opacity: at([0, 0.46, 0.48, 0.68, 1], [0, 0, 0.9, 0, 0]), transform: [{ scale: at([0, 0.46, 0.68, 1], [0.6, 0.6, 2.4, 2.4]) }] }]}
      />
      {SHARDS.map((sh, i) => (
        <Animated.View key={i} style={[layer, { transform: [{ translateY: at(sh.at, sh.y.map((y) => y * unit)) }] }]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Body id={`shard${i}`} />
            <Polygon points={sh.points} fill={sh.fill} clipPath={`url(#shard${i})`} />
            <Nfc x={133} y={sh.nfc} />
          </Svg>
        </Animated.View>
      ))}
      <Animated.View
        style={[layer, { opacity: at([0, 0.38, 0.46, 0.82, 0.88, 1], [0, 0, 1, 1, 0, 0]), transform: [{ scaleX: at([0, 0.38, 0.48, 1], [0.01, 0.01, 1, 1]) }] }]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Body id="seams" />
          <Path d={SEAMS} fill="none" stroke={Colors.gold} strokeWidth={5} strokeLinejoin="round" clipPath="url(#seams)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[sealBox(11.5), { backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
        { transform: [{ scale: at([0, 0.42, 0.49, 0.55, 0.8, 0.86, 1], [0, 0, 1.25, 1, 1, 0, 0]) }] }]}>
        <View style={{ width: 20 * unit, height: 20 * unit, borderRadius: 10 * unit, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 9 * unit, height: 9 * unit, borderRadius: 4.5 * unit, borderWidth: Math.max(1, 1.5 * unit), borderColor: 'rgba(247,240,217,0.8)' }} />
        </View>
      </Animated.View>
    </View>
  );
}
