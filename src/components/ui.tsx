import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getNetworkStateAsync } from 'expo-network';
import React, { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, View, type TextInputProps, type ViewStyle } from 'react-native';

import { Text, TextInput } from '@/components/text';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

/** The top of every pushed screen: back chevron and a serif title (replaces the native header). */
export function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + Spacing.sm, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xs, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.background }}>
      {onBack && (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chevron-back" />
        </Pressable>
      )}
      <Text style={[Type.title, !onBack && { marginLeft: Spacing.md }]} numberOfLines={1}>{title}</Text>
    </View>
  );
}

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

/**
 * `busy` is true from the tap until `onPress` finishes (sync or async): show a spinner so slow work never
 * looks frozen. The handler runs a frame later: heavy sync work (hashing photos, deriving keys) blocks JS,
 * and the spinner must be on screen before it starts. Android's spinner keeps turning on the UI thread.
 */
export function useBusy(onPress: () => unknown) {
  const [busy, setBusy] = useState(false);
  const press = async () => {
    setBusy(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      await onPress();
    } finally {
      setBusy(false);
    }
  };
  return [busy, press] as const;
}

export function Button({ title, onPress, kind = 'primary', disabled }: { title: string; onPress: () => unknown; kind?: 'primary' | 'secondary' | 'link'; disabled?: boolean }) {
  const [busy, press] = useBusy(onPress);
  const color = kind === 'primary' ? Colors.white : Colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled || busy}
      onPress={press}
      style={[s.btn, kind === 'secondary' && s.btnSecondary, kind === 'link' && s.btnLink, disabled && { opacity: 0.4 }]}>
      {busy ? <ActivityIndicator color={color} /> : <Text style={[s.btnText, { color }]}>{title}</Text>}
    </Pressable>
  );
}

/** Muted intro paragraph at the top of a screen. */
export const Intro = ({ children }: { children: React.ReactNode }) => <Text style={[Type.body, { color: Colors.inkSoft }]}>{children}</Text>;

export const ErrorText = ({ children }: { children?: string }) => (children ? <Text style={[Type.small, { color: Colors.negative }]}>{children}</Text> : null);

/** Full-screen wait while the user holds a tag/YubiKey (`hint` shows the phone) or the network works. */
export function Busy({ message, hint, onCancel }: { message: string; hint?: string; onCancel?: () => void }) {
  const tap = message.startsWith('Hold');
  return (
    <>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 }}>
        {tap ? (
          <Breathing />
        ) : (
          <ActivityIndicator size="large" color={Colors.primary} />
        )}
        <Text style={[tap ? Type.title : Type.heading, { textAlign: 'center' }]}>{message}</Text>
        {!!hint && <Text style={[Type.small, { textAlign: 'center', maxWidth: 280 }]}>{hint}</Text>}
      </View>
      {onCancel && <Button kind="secondary" title="Cancel" onPress={onCancel} />}
    </>
  );
}

/** Two rings around a buzzing phone, slowly breathing in and out while we wait for a tap. */
function Breathing() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1800, easing: ease, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1800, easing: ease, useNativeDriver: true }),
      ]),
    );
    AccessibilityInfo.isReduceMotionEnabled().then((still) => !still && loop.start());
    return () => loop.stop();
  }, [t]);
  const breathe = (from: number, to: number) => ({ transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }] });
  return (
    <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[s.ring, { position: 'absolute', width: 180, height: 180 }, breathe(0.92, 1.08), { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }]} />
      <Animated.View style={[s.ring, { width: 120, height: 120, backgroundColor: 'rgba(15,61,46,0.16)' }, breathe(0.97, 1.03)]}>
        <MaterialCommunityIcons name="vibrate" color={Colors.primary} size={52} />
      </Animated.View>
    </View>
  );
}

export type IconName =React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, color = Colors.ink, size = 22 }: { name: IconName; color?: string; size?: number }) => <Ionicons name={name} color={color} size={size} />;

/**
 * One line in a List card: icon or badge, title, optional detail, a value on the right, and a chevron
 * when it opens something. `active` highlights the step happening now.
 */
export function Row({ icon, badge, badgeTone, title, detail, right, rightTone, tone, active, oneLine, onPress }: {
  icon?: IconName; badge?: IconName | string; badgeTone?: 'positive' | 'negative'; title: string; detail?: string; right?: string; oneLine?: boolean;
  rightTone?: 'positive' | 'negative'; tone?: 'positive' | 'negative' | 'accent'; active?: boolean; onPress?: () => void;
}) {
  const color = tone ? Colors[tone] : Colors.ink;
  const badgeColor = badgeTone ? Colors[badgeTone] : Colors.primary;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [s.row, active && { backgroundColor: Colors.primarySoft }, pressed && { backgroundColor: Colors.surfaceAlt }]}>
      {icon && <Icon name={icon} color={tone ? color : Colors.primary} size={24} />}
      {!!badge && (
        <View style={[s.badge, { backgroundColor: badgeTone ? Colors[`${badgeTone}Soft`] : Colors.primarySoft }]}>
          {badge.length > 2 ? <Icon name={badge as IconName} color={badgeColor} size={20} /> : <Text style={{ fontWeight: '700', fontSize: 16, color: badgeColor }}>{badge}</Text>}
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Type.heading, tone === 'negative' && { color }]} numberOfLines={oneLine ? 1 : undefined}>{title}</Text>
        {!!detail && <Text style={Type.small} numberOfLines={oneLine ? 1 : undefined}>{detail}</Text>}
      </View>
      {!!right && <Text style={[Type.heading, { fontVariant: ['tabular-nums'] }, rightTone && { color: Colors[rightTone] }]}>{right}</Text>}
      {onPress && !right && <Icon name="chevron-forward" color={Colors.inkFaint} size={18} />}
    </Pressable>
  );
}

/** A card of Rows with hairlines between them, under an optional section label. */
export function List({ label, children }: { label?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: 10 }}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <View style={[s.card, { padding: 0, overflow: 'hidden' }]}>
        {rows.map((r, i) => (
          <View key={i} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }}>
            {r}
          </View>
        ))}
      </View>
    </View>
  );
}

/** A selectable card. Checkbox-style unless `compact` (small side-by-side cards: the border shows the pick). */
export function Choice({ title, body, selected, onPress, disabled, tag, compact, style }: {
  title: string; body?: string; selected: boolean; onPress: () => void; disabled?: boolean; tag?: string; compact?: boolean; style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.card, { borderWidth: 2, borderColor: selected ? Colors.primary : Colors.border, flexDirection: 'row', gap: 14 }, compact && { padding: Spacing.md }, disabled && { opacity: 0.45 }, style]}>
      {!compact && <Icon name={selected ? 'checkbox' : 'square-outline'} color={selected ? Colors.primary : Colors.inkFaint} size={24} />}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
          <Text style={[Type.heading, compact && { fontSize: 15 }]}>{title}</Text>
          {!!tag && <Text style={s.tag}>{tag}</Text>}
        </View>
        {!!body && <Text style={[Type.small, compact && { fontSize: 12 }]}>{body}</Text>}
      </View>
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
  const [shown, setShown] = useState(false);
  const input = (
    <TextInput
      {...props}
      secureTextEntry={props.secureTextEntry && !shown}
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
      style={[s.input, props.secureTextEntry && { paddingRight: 52 }, style]}
    />
  );
  if (!props.secureTextEntry) return input;
  return (
    <View style={{ justifyContent: 'center' }}>
      {input}
      <Pressable onPress={() => setShown(!shown)} hitSlop={12} accessibilityRole="button" accessibilityLabel={shown ? 'Hide' : 'Show'} style={{ position: 'absolute', right: 16 }}>
        <Icon name={shown ? 'eye-off-outline' : 'eye-outline'} color={Colors.inkSoft} />
      </Pressable>
    </View>
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
  screen: { paddingHorizontal: 20, paddingTop: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.lg, flexGrow: 1 },
  card: { backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  btnSecondary: { backgroundColor: Colors.neutralChip },
  btnLink: { backgroundColor: 'transparent' },
  btnText: { color: Colors.white, fontWeight: '600', fontSize: 16 },
  segmented: { flexDirection: 'row', backgroundColor: Colors.neutralChip, borderRadius: Radius.full, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.full },
  input: { backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, ...Type.body },
  label: { ...Type.tiny, color: Colors.inkSoft, marginTop: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.lg, paddingVertical: 14, minHeight: 64 },
  badge: { width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  ring: { borderRadius: Radius.full, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  tag: { fontSize: 11, fontWeight: '600', color: Colors.white, backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, overflow: 'hidden' },
});
