import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Header, Icon, type IconName } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';

const ICONS: Record<string, IconName> = { home: 'home', activity: 'time', swap: 'swap-horizontal', settings: 'settings' };
const PAD = 6;

/** The always-there bottom menu: a floating capsule where a fir bubble slides under the active tab. */
function SlidingBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const at = useRef(new Animated.Value(state.index)).current;
  useEffect(() => {
    Animated.spring(at, { toValue: state.index, friction: 7, tension: 120, useNativeDriver: true }).start();
  }, [state.index, at]);
  const slot = (width - 2 * PAD) / state.routes.length;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row', marginHorizontal: 16, marginBottom: insets.bottom + 8, marginTop: 4, padding: PAD,
        backgroundColor: Colors.card, borderRadius: 24, borderWidth: 1, borderColor: Colors.border,
        elevation: 4, shadowColor: Colors.ink, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
      }}>
      {width > 0 && (
        <Animated.View
          style={{
            position: 'absolute', top: PAD, bottom: PAD, left: PAD, width: slot, borderRadius: 18, backgroundColor: Colors.primary,
            transform: [{ translateX: Animated.multiply(at, slot) }],
          }}
        />
      )}
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const color = focused ? Colors.white : Colors.inkSoft;
        const icon = ICONS[route.name];
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 9, borderRadius: Radius.lg }}>
            <Icon name={(focused ? icon : `${icon}-outline`) as IconName} color={color} />
            <Text style={{ fontSize: 12, fontWeight: '600', color }}>{descriptors[route.key].options.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <SlidingBar {...props} />}
      screenOptions={{
        header: ({ options }) => <Header title={options.title ?? ''} />,
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', headerShown: false }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="swap" options={{ title: 'Swap' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
