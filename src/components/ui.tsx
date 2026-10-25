import Ionicons from '@expo/vector-icons/Ionicons';
import { getNetworkStateAsync } from 'expo-network';
import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';

/** `noHeader` screens pad under the status bar themselves; `onRefresh` adds pull-to-refresh. */
export function Screen({ children, noHeader, onRefresh }: { children: React.ReactNode; noHeader?: boolean; onRefresh?: () => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      refreshControl={
        onRefresh && (
          <RefreshControl
            refreshing={refreshing}
            colors={[Colors.primary]}
            onRefresh={() => {
              setRefreshing(true);
              onRefresh().finally(() => setRefreshing(false));
            }}
          />
        )
      }
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

/** Muted intro paragraph at the top of a screen. */
export const Intro = ({ children }: { children: React.ReactNode }) => <Text style={[Type.body, { color: Colors.inkSoft }]}>{children}</Text>;

export const ErrorText = ({ children }: { children?: string }) => (children ? <Text style={[Type.small, { color: Colors.negative }]}>{children}</Text> : null);

/** Full-screen wait while the user holds a tag/YubiKey or the network works. */
export function Busy({ message, onCancel }: { message: string; onCancel?: () => void }) {
  return (
    <>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[Type.heading, { textAlign: 'center' }]}>{message}</Text>
      </View>
      {onCancel && <Button kind="secondary" title="Cancel" onPress={onCancel} />}
    </>
  );
}

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, color = Colors.ink, size = 22 }: { name: IconName; color?: string; size?: number }) => <Ionicons name={name} color={color} size={size} />;

/** One line in a list card: icon, title, optional detail, and a chevron when it opens something. */
export function Row({ icon, badge, title, detail, right, rightTone, tone, onPress }: { icon?: IconName; badge?: string; title: string; detail?: string; right?: string; rightTone?: 'positive'; tone?: 'positive' | 'negative' | 'accent'; onPress?: () => void }) {
  const color = tone ? Colors[tone] : Colors.ink;
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
      {icon && <Icon name={icon} color={tone ? color : Colors.primary} />}
      {!!badge && (
        <View style={{ width: 32, height: 32, borderRadius: Radius.full, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '700', color: Colors.primary }}>{badge}</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Type.heading, tone === 'negative' && { color }]}>{title}</Text>
        {!!detail && <Text style={Type.small}>{detail}</Text>}
      </View>
      {!!right && <Text style={[Type.body, rightTone && { color: Colors[rightTone] }]}>{right}</Text>}
      {onPress && <Icon name="chevron-forward" color={Colors.inkFaint} size={18} />}
    </Pressable>
  );
}

/** A card of Rows with hairlines between them, under an optional section label. */
export function List({ label, children }: { label?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: Spacing.sm }}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <View style={[s.card, { paddingVertical: 0 }]}>
        {rows.map((r, i) => (
          <View key={i} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }}>
            {r}
          </View>
        ))}
      </View>
    </View>
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
      style={[s.card, { borderWidth: 2, borderColor: selected ? Colors.primary : Colors.border, flexDirection: 'row', gap: Spacing.sm }, disabled && { opacity: 0.45 }, style]}>
      <View style={{ flex: 1 }}>
        <Text style={Type.heading}>{title}</Text>
        {!!body && <Text style={[Type.small, { marginTop: 4 }]}>{body}</Text>}
      </View>
      <Icon name={selected ? 'checkmark-circle' : 'ellipse-outline'} color={selected ? Colors.primary : Colors.inkFaint} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, minHeight: 56 },
});
