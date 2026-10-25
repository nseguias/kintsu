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
  primaryInk: '#0F3D2E',
  primarySoft: 'rgba(15,61,46,0.10)',
  // accent — terracotta, used sparingly for small actions
  accent: '#C8643E',
  accentSoft: 'rgba(200,100,62,0.12)',
  // semantics — green = owed to you, terracotta = you owe
  positive: '#1F7A3E',
  positiveSoft: 'rgba(31,122,62,0.12)',
  negative: '#C0492C',
  negativeSoft: 'rgba(192,73,44,0.12)',
  neutralChip: '#EFE7CB',
  white: '#FFFFFF',
};

/** Font families. Serif (Fraunces) for display + numbers; system sans for UI text. */
export const Fonts = {
  serif: 'Fraunces_600SemiBold',
  serifBold: 'Fraunces_700Bold',
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

export const Type = {
  // serif display
  hero: { fontFamily: Fonts.serif, fontSize: 52, color: Colors.ink },
  display: { fontFamily: Fonts.serif, fontSize: 34, color: Colors.ink },
  title: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.ink },
  // sans UI
  heading: { fontSize: 17, fontWeight: '600' as const, color: Colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.ink },
  small: { fontSize: 13, fontWeight: '400' as const, color: Colors.inkSoft },
  tiny: { fontSize: 11, fontWeight: '600' as const, color: Colors.inkFaint, letterSpacing: 0.3 },
  // serif numbers (amounts)
  num: { fontFamily: Fonts.serif, color: Colors.ink, fontVariant: ['tabular-nums' as const] },
};

// curated, on-brand avatar palette (deep fir, terracotta, olive, clay, teal, plum)
export const AvatarPalette = [
  '#0F3D2E',
  '#C8643E',
  '#8A7B2F',
  '#3A6B5C',
  '#A6533A',
  '#5C6B3A',
  '#7A4B3A',
  '#2F5E55',
  '#B07A2E',
  '#6E4A5C',
];
