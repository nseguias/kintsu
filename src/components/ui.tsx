import { getNetworkStateAsync } from 'expo-network';
import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';

/** `noHeader` screens pad under the status bar themselves. */
export function Screen({ children, noHeader }: { children: React.ReactNode; noHeader?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={[s.screen, { paddingBottom: Spacing.xxl + insets.bottom }, noHeader && { paddingTop: insets.top + Spacing.lg }]}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'link'; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.btn, kind === 'secondary' && s.btnSecondary, kind === 'link' && s.btnLink, disabled && { opacity: 0.4 }]}>
      <Text style={[s.btnText, kind !== 'primary' && { color: Colors.primary }]}>{title}</Text>
    </Pressable>
  );
}

/** A selectable card: radio or checkbox, depending on how the caller uses `selected`. */
export function Choice({ title, body, selected, onPress, disabled, style }: { title: string; body?: string; selected: boolean; onPress: () => void; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.card, { borderWidth: 2, borderColor: selected ? Colors.primary : Colors.border }, disabled && { opacity: 0.45 }, style]}>
      <Text style={Type.heading}>{title}</Text>
      {!!body && <Text style={[Type.small, { marginTop: 4 }]}>{body}</Text>}
    </Pressable>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segmented} accessibilityRole="radiogroup">
      {options.map((o) => (
        <Pressable key={String(o.value)} accessibilityRole="radio" accessibilityState={{ selected: o.value === value }} onPress={() => onChange(o.value)} style={[s.segment, o.value === value && { backgroundColor: Colors.primary }]}>
          <Text style={{ fontWeight: '600', color: o.value === value ? Colors.white : Colors.primary }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Secrets are typed by hand from paper: no paste menu, no autofill, no suggestions/learning.
 * ponytail: paste is also blocked by rejecting any edit that adds 4+ characters at once (keyboard
 * clipboard chips insert in one go). Up to 3 is allowed because a busy JS thread can batch fast
 * keystrokes; the ceiling is that pasting a 3-letter word still gets through.
 */
const MAX_INSERT = 3;
export function SecretInput({ value, onChangeText, style, ...props }: TextInputProps & { value: string; onChangeText: (t: string) => void }) {
  return (
    <TextInput
      {...props}
      value={value}
      onChangeText={(t) => t.length - value.length <= MAX_INSERT && onChangeText(t)}
      contextMenuHidden
      autoCorrect={false}
      autoCapitalize="none"
      autoComplete="off"
      importantForAutofill="no"
      spellCheck={false}
      keyboardType={props.secureTextEntry ? 'default' : 'visible-password'}
      placeholderTextColor={Colors.inkFaint}
      style={[s.input, style]}
    />
  );
}

/** Shows secrets only while the phone has no network at all (airplane mode, Wi‑Fi off). */
// ponytail: polled, because the network-change listener missed going offline on the emulator.
// Polling also hides secrets again within a second if the phone reconnects.
export function OfflineOnly({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const check = () => getNetworkStateAsync().then((n) => setOffline(n.isConnected === false), () => setOffline(false));
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, []);
  if (!offline) {
    return (
      <View style={[s.card, { backgroundColor: Colors.accentSoft, borderColor: Colors.accent }]}>
        <Text style={Type.heading}>Turn on airplane mode</Text>
        <Text style={[Type.small, { marginTop: 4 }]}>Your words only appear while this phone is fully offline. Make sure Wi‑Fi is off too.</Text>
      </View>
    );
  }
  return <>{children}</>;
}

export const s = StyleSheet.create({
  screen: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md, flexGrow: 1 },
  card: { backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 15, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  btnSecondary: { backgroundColor: Colors.neutralChip },
  btnLink: { backgroundColor: 'transparent' },
  btnText: { color: Colors.white, fontWeight: '600', fontSize: 16 },
  segmented: { flexDirection: 'row', backgroundColor: Colors.neutralChip, borderRadius: Radius.full, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.full },
  input: { backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, ...Type.body },
  label: { ...Type.tiny, marginTop: Spacing.sm },
});
