export const Colors = {
  // surfaces — warm "butter" ground
  background: '#F7F0D9',
  card: '#FFFCF4',
  surfaceAlt: '#F1E9CE',
  border: '#E7DCBF',
  // text
  ink: '#1A1A12',
  inkSoft: '#6E6A54',
  inkFaint: '#A39C82',
  // brand — deep fir green is the primary (FAB, selected, primary buttons)
  primary: '#0F3D2E',
  primarySoft: 'rgba(15,61,46,0.10)',
  // accent — terracotta, used sparingly for small actions
  accent: '#C8643E',
  accentSoft: 'rgba(200,100,62,0.12)',
  // gold — only for the logo's kintsugi seams
  gold: '#C9A13B',
  // semantics — green = done/safe, red = warning or destructive
  positive: '#1F7A3E',
  positiveSoft: 'rgba(31,122,62,0.12)',
  negative: '#C0492C',
  negativeSoft: 'rgba(192,73,44,0.12)',
  neutralChip: '#EFE7CB',
  white: '#FFFFFF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
};

/** Fraunces everywhere: Text/TextInput from @/components/text pick its file from fontWeight. */
export const Type = {
  // display
  display: { fontSize: 34, fontWeight: '600' as const, color: Colors.ink },
  title: { fontSize: 22, fontWeight: '600' as const, color: Colors.ink },
  // UI
  heading: { fontSize: 17, fontWeight: '600' as const, color: Colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.ink },
  small: { fontSize: 13, fontWeight: '400' as const, color: Colors.inkSoft },
  tiny: { fontSize: 11, fontWeight: '600' as const, color: Colors.inkFaint, letterSpacing: 0.3 },
  // addresses, keys, hashes
  mono: { fontFamily: 'monospace', fontSize: 15, color: Colors.ink },
  // numbers (amounts)
  num: { fontWeight: '600' as const, color: Colors.ink, fontVariant: ['tabular-nums' as const] },
};
