import React from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type StyleProp, type TextStyle } from 'react-native';

/**
 * Text and TextInput in Fraunces everywhere: import these instead of react-native's. Android picks a
 * custom font by file, not by fontWeight, so the weight in the style chooses the Fraunces file.
 * An explicit fontFamily (monospace keys, icon fonts) is left alone.
 */
function fraunces(style: StyleProp<TextStyle>): TextStyle | undefined {
  const s = StyleSheet.flatten(style) ?? {};
  if (s.fontFamily) return undefined;
  const w = s.fontWeight === 'bold' ? 700 : Number(s.fontWeight ?? 400);
  return { fontFamily: w >= 700 ? 'Fraunces_700Bold' : w >= 600 ? 'Fraunces_600SemiBold' : 'Fraunces_400Regular', fontWeight: 'normal' };
}

export const Text = ({ style, ...props }: React.ComponentProps<typeof RNText>) => <RNText {...props} style={[style, fraunces(style)]} />;
export const TextInput = ({ style, ...props }: React.ComponentProps<typeof RNTextInput>) => <RNTextInput {...props} style={[style, fraunces(style)]} />;
